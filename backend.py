import cv2
import numpy as np
import base64
import random
import google.generativeai as genai
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

import traceback


# --- CONFIGURATION ---

genai.configure(api_key="AIzaSyCYUzL_y8r-AUuSPiSbBahgmxclZd3pqNQ")
model_gemini = genai.GenerativeModel('gemini-2.5-flash-lite')
model_yolo = YOLO('yolov8n.pt') # Lightweight for speed

app = FastAPI()

# Allow React to talk to FastAPI
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://flintiest-interdepartmentally-corene.ngrok-free.dev",
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

VALID_CLASSES = [56, 57, 58, 59, 60, 62, 63, 72]

@app.post("/analyze")
async def analyze(data: dict = Body(...)):
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

            if label.lower() == "person":
                continue
            
            risk = calculate_risk(y2-y1, x2-x1, data['magnitude'], ratio)
            
            detections.append({
                "id": track_id,
                "label": label,
                "bbox": [x1, y1, x2, y2],
                "risk": round(risk, 1)
            })

    shared_state["detections"] = detections 

    return {"detections": detections}


@app.post("/recommend")
async def recommend(data: dict = Body(...)):
    try:
        risky_items = [d['label'] for d in data.get('detections', []) if d.get('risk', 0) > 50]
        raw_detections = data.get('detections', [])
        
        # 1. Use a dictionary to de-duplicate by 'id'
        # This keeps only the LATEST version of each unique object seen
        unique_objects = {}
        for d in raw_detections:
            obj_id = d.get('id')
            # Only add if it has an ID and high risk
            if obj_id and d.get('risk', 0) > 50:
                unique_objects[obj_id] = d['label']

        # 2. Extract just the names (e.g., ["bookshelf", "tv"])
        risky_items = list(unique_objects.values())

        if not risky_items:
            return {"advice": "Room looks secure! No major hazards detected."}

        prompt = f"In an earthquake, these items might fall: {', '.join(risky_items)}. Provide a priority order of objects to secure and how, or none of none needed. Keep the response under 100 words in bullet point format."
        
        # Try the real AI
        try:
            # TRY THE REAL CALL
            response = model_gemini.generate_content(prompt)
            return {"advice": response.text}
        except Exception as api_err:
            # THIS IS THE IMPORTANT PART:
            print("\n--- GEMINI API CRASH REPORT ---")
            traceback.print_exc() # This prints the EXACT line and error to your terminal
            print("-------------------------------\n")
            
            # Keep the fallback so the UI doesn't break
            return {"advice": f"Secure heavy furniture, including chairs and tables to the floor with L-brackets or furniture straps."}

    except Exception as e:
        traceback.print_exc()
        return {"advice": "Internal Server Error."}
    