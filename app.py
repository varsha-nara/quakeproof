import cv2
import numpy as np
import base64
import random
import google.generativeai as genai
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from fastapi.responses import JSONResponse

import traceback
import os
from dotenv import load_dotenv

# --- CONFIGURATION ---

# Load .env (if present) and read the Gemini API key
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("GEMINI_API_KEY not found in environment or .env")
genai.configure(api_key=api_key)
model_gemini = genai.GenerativeModel('gemini-3-flash-preview')
model_yolo = YOLO('best.pt') # Lightweight for speed

app = FastAPI()

# Allow React to talk to FastAPI
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://flintiest-interdepartmentally-corene.ngrok-free.dev",
    "https://quakeproof-2evp.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Be specific here
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants for Scaling & Physics
KNOWN_HEIGHTS = {"door": 2.1, "chair": 0.9, "couch": 0.5, "tv": 0.6}
GRAVITY_THRESHOLD = 35.0 # Adjusted constant for tipping logic

def calculate_risk(height_px, width_px, magnitude, ratio):
    """Monte Carlo simulation for fall probability"""
    h_m = height_px * ratio
    w_m = width_px * ratio
    stability = w_m / h_m
    falls = 0
    trials = 20
    
    for _ in range(trials):
        shaking = (magnitude ** 2) * random.uniform(0.5, 1.5)
        if shaking > (stability * GRAVITY_THRESHOLD):
            falls += 1
    return (falls / trials) * 100


shared_state = {
    "magnitude": 5.0,
    "detections": [],
    "advice": ""
}

@app.get("/state")
async def get_state():
    return shared_state

@app.post("/update_magnitude")
async def update_mag(data: dict = Body(...)):
    shared_state["magnitude"] = float(data.get("magnitude", 5.0))
    return {"status": "ok"}

@app.post("/analyze")
async def analyze(data: dict = Body(...)):
    try:
        # 1. Decode Base64 Image
        header, encoded = data['image'].split(",", 1)
        nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # 2. YOLO Tracking
        results = model_yolo.track(img, persist=True)[0]
        
        # 3. Find Scaling Ratio (Look for a door or chair)
        ratio = 0.002 # Default fallback
        if results.boxes:
            for box in results.boxes:
                label = model_yolo.names[int(box.cls[0])]
                if label in KNOWN_HEIGHTS:
                    h_px = box.xyxy[0][3] - box.xyxy[0][1]
                    ratio = KNOWN_HEIGHTS[label] / float(h_px)
                    break

        detections = []
        if results.boxes:
            for box in results.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                label = model_yolo.names[int(box.cls[0])]
                track_id = int(box.id[0]) if box.id is not None else 0
                
                risk = calculate_risk(y2-y1, x2-x1, data['magnitude'], ratio)
                
                detections.append({
                    "id": track_id,
                    "label": label,
                    "bbox": [x1, y1, x2, y2],
                    "risk": round(risk, 1)
                })

        shared_state["detections"] = detections 

        return JSONResponse(content={"detections": detections})
    
    except Exception as e:
        print("\n--- /analyze ENDPOINT ERROR ---")
        traceback.print_exc()
        print("-------------------------------\n")
        return JSONResponse(content={"error": str(e), "detections": []}, status_code=500)


@app.post("/recommend")
async def recommend(data: dict = Body(...)):
    try:
        risky_items = data.get('detections', [])

        if not risky_items:
            return JSONResponse(content={"advice": "Room looks secure! No major hazards detected."})

        prompt = f"In an earthquake, these items might fall: {', '.join(risky_items)}. Provide a priority order of how to secure/where to move these objects to prepare, or nothing if not needed. Keep response under 100 words in bullet point format."
        
        # Try the real AI
        try:
            response = model_gemini.generate_content(prompt)
            return JSONResponse(content={"advice": response.text})
        except Exception as api_err:
            print("\n--- GEMINI API CRASH REPORT ---")
            traceback.print_exc()
            print("-------------------------------\n")
            
            # Keep the fallback so the UI doesn't break
            return JSONResponse(content={"advice": f"Secure heavy furniture, including chairs and tables to the floor with L-brackets or furniture straps."})

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(content={"advice": "Internal Server Error."}, status_code=500)


@app.post("/extract")
async def extract(
    video: UploadFile = File(...),
    prompt: str = Form(...)
):
    try:
        # Save video to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            tmp.write(await video.read())
            video_path = tmp.name

        # Open video
        cap = cv2.VideoCapture(video_path)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        # Pick 3 frames safely
        indices = [
            int(frame_count * 0.1),
            int(frame_count * 0.5),
            int(frame_count * 0.9),
        ]

        parts = [prompt]

        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret:
                continue

            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame)
            parts.append(pil_img)

        cap.release()

        response = model_gemini.generate_content(parts)
        return JSONResponse(content={"text": response.text})

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            content={"error": f"Extract failed: {str(e)}"},
            status_code=500
        )