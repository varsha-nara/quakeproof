import React, { useRef, useState, useEffect, Suspense } from 'react';
import Webcam from 'react-webcam';
import { Canvas, useFrame } from '@react-three/fiber'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { OrbitControls, Environment, Sky, Grid, useTexture, Text } from '@react-three/drei'
import { GoogleGenerativeAI } from "@google/generative-ai"

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(API_KEY)

const DENSITIES = {
  refrigerator: 300,
  bookshelf: 180,
  sofa: 100,
  table: 120,
  tv: 60,
  monitor: 50,
  chair: 70,
  lamp: 40,
  default: 80
}

function Room({ magnitude }) {
  const rigidBody = useRef()
  useFrame(({ clock }) => {
    if (!rigidBody.current || magnitude === 0) return
    const t = clock.getElapsedTime()
    const intensity = Math.pow(magnitude / 9, 3)
    const freq = 10 + magnitude * 2
    const amp = intensity * 0.3
    
    rigidBody.current.setNextKinematicTranslation({
      x: Math.sin(t * freq) * amp,
      y: 0,
      z: Math.cos(t * freq * 1.1) * amp
    })
  })

  return (
    <RigidBody ref={rigidBody} type="kinematicPosition" colliders={false}>
      <CuboidCollider args={[30, 0.1, 30]} friction={2.0} restitution={0.1} />
      <Grid infiniteGrid fadeDistance={60} sectionColor="#444" cellColor="#222" />
    </RigidBody>
  )
}


function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [magnitude, setMagnitude] = useState(0.0);
  const [advice, setAdvice] = useState("");
  const [detections, setDetections] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false); // New lock state
  const [mode] = useState(new URLSearchParams(window.location.search).get("mode") || "laptop");
  const [previewImage, setPreviewImage] = useState(null)
  const [detectedObjects, setDetectedObjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("Waiting for video upload...")


  const analyzeVideo = async (file) => {
    setLoading(true)
    setStatus("Extracting Spatial Data...")

    try {
      const video = document.createElement('video')
      video.src = URL.createObjectURL(file)
      video.muted = true
      video.playsInline = true
      video.crossOrigin = "anonymous"

      await new Promise(r => video.onloadedmetadata = r)

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const frames = []
      const captureTimes = [0.1, video.duration * 0.5, video.duration - 0.2]

      for (const time of captureTimes) {
        video.currentTime = time
        await new Promise(r => video.onseeked = r)
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)
        const base64 = canvas.toDataURL('image/jpeg', 0.4).split(',')[1]
        frames.push({ inlineData: { data: base64, mimeType: "image/jpeg" } })
        if (time === 0.1) setPreviewImage(canvas.toDataURL('image/jpeg'))
      }

      setStatus("Mapping Room...")

      // Using the latest available stable endpoint
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

      const prompt = `
        Act as a 3D LiDAR scanner. Identify major structural objects:
        Types: [bookshelf, refrigerator, chair, table, lamp, tv, sofa, monitor]
        
        For each object, estimate:
        1. type: (from the list above)
        2. size: [width, height, depth] in meters (Scale them up slightly for presence).
        3. color: Primary HEX code.
        4. x, z: Coordinates (-12 to 12).

        Return ONLY a JSON array: [{"type": "table", "size": [2.0, 0.8, 1.2], "color": "#ffffff", "x": -2, "z": -4}]
      `

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }, ...frames] }]
      })

      const text = result.response.text()
      const jsonMatch = text.match(/\[.*\]/s)
      if (!jsonMatch) throw new Error("Invalid AI Spatial Response")

      const parsed = JSON.parse(jsonMatch[0])
      
      const processed = parsed.map(obj => ({
        ...obj,
        // Enforce slightly bigger sizes if the AI estimates too small
        size: obj.size.map(s => Math.max(s * 1.2, 0.5)), 
        x: Number(obj.x) || 0,
        z: Number(obj.z) || 0
      }))

      setDetectedObjects(processed)
      setStatus(`Reconstruction Complete: ${processed.length} Hazards Found.`)

    } catch (err) {
      console.error(err)
      setStatus("Error: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  
  const magRef = useRef(magnitude);
  useEffect(() => {
    magRef.current = magnitude;
  }, [magnitude]);

  const processFrame = async () => {
    // Guard clause: if webcam isn't ready, wait and try again
    if (!webcamRef.current) {
      setTimeout(processFrame, 500);
      return;
    }

    // If we are already mid-fetch, don't do anything (The Lock)
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      const imageSrc = webcamRef.current.getScreenshot({
        width: 320, // Keep this small!
        height: 240
      });

      if (imageSrc) {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Use magRef.current so we don't depend on 'magnitude' state in the effect
          body: JSON.stringify({ image: imageSrc, magnitude: parseFloat(magRef.current) })
        });

        if (response.status === 429) {
            await new Promise(r => setTimeout(r, 2000));
        } else if (response.ok) {
            const data = await response.json();
            setDetections(data.detections);
            drawOnCanvas(data.detections);
        }
      }
    } catch (err) {
      console.error("Analysis stalled, retrying...", err);
    } finally {
      setIsProcessing(false);
      setTimeout(processFrame, 300); 
    }
  };

  // Start the chain ONCE on mount
  useEffect(() => {
    processFrame();
    // Empty dependency array ensures this loop never "restarts" and stacks up
  }, []);

  const drawOnCanvas = (dets) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.font = "20px Arial";
    if (!dets || dets.length === 0) return;

    dets.forEach(d => {
      if (!d.bbox) return;
      const [x1, y1, x2, y2] = d.bbox.map(coord => coord * 2);
      ctx.strokeStyle = d.risk > 70 ? "red" : d.risk > 30 ? "orange" : "green";
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.fillStyle = "white";
      ctx.fillText(`${d.risk}%`, x1, y1 - 5);
    });
  };

  const getAdvice = async () => {
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ detections })
    });
    const data = await res.json();
    setAdvice(data.advice);
  };

  useEffect(() => {
    const interval = setInterval(processFrame, 500); // Process 2 times per second
    return () => clearInterval(interval);
  }, [magnitude]);

  useEffect(() => {
    const sync = async () => {
      const res = await fetch("/api/state");
      const state = await res.json();
      
      if (mode === "phone") {
        setMagnitude(state.magnitude); // Phone gets magnitude from Laptop
      } else {
        setDetections(state.detections); // Laptop gets boxes from Phone
      }
    };
    const interval = setInterval(sync, 500);
    return () => clearInterval(interval);
  }, [mode]);

  if (mode === "phone") {
    return (
      <div className="relative w-screen h-screen">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{
            facingMode: "environment", // This forces the REAR camera
            width: { ideal: 640 },
            height: { ideal: 480 }
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100vw', // Make it responsive for phone screens
            height: 'auto',
            zIndex: 1
          }}
        />

        {/* Canvas must be ABSOLUTE and match the Video exactly */}
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '640px',
            height: '480px',
            zIndex: 2, // Sits on top of the webcam
            pointerEvents: 'none' // Allows clicks to pass through to the video if needed
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050505', overflow: 'hidden', fontFamily: 'monospace' }}>
      <style>{`
        body { margin: 0; padding: 0; overflow: hidden; background: #050505; }
        canvas { display: block; width: 100vw !important; height: 100vh !important; }
      `}</style>

      {/* Sidebar UI */}
      <div style={{
        left: '20px', top: '20px', position: 'absolute', zIndex: 10, padding: '30px', color: 'white',
        background: 'rgba(10,10,10,0.55)', width: 'auto',
        borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '20px',
        height: 'auto'
      }}>
        <h1 style={{ color: '#00ffcc', letterSpacing: '4px', fontSize: '22px', margin: 0 }}>QUAKEPROOF</h1>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, #00ffcc, transparent)' }} />
        
        <div style={{ padding: '15px', background: '#111', borderRadius: '4px', border: '1px solid #222' }}>
          <input type="file" accept="video/*" onChange={(e) => e.target.files[0] && analyzeVideo(e.target.files[0])} style={{ width: '100%' }} />
          <p style={{ fontSize: '12px', color: loading ? '#ffcc00' : '#00ffcc', marginTop: '10px' }}>{status}</p>
        </div>

        {/* <div>
          <label className="block mb-4 text-xl">Simulate Intensity: {magnitude}</label>
          <input 
            type="range" min="0" max="9" step="0.1" 
            value={magnitude} 
            onChange={async (e) => {
              const val = e.target.value;
              setMagnitude(val);
              await fetch("/api/update_magnitude", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({magnitude: val})
              });
            }}
            className="w-full h-4 bg-blue-700 rounded-lg appearance-none cursor-pointer"
          />
          
          <button onClick={getAdvice} className="mt-8 bg-blue-600 p-4 w-full rounded-xl text-2xl font-bold">
            Get Improvements
          </button>
          
          {advice && <div className="mt-4 p-6 bg-gray-800 rounded-lg border-l-4 border-blue-500">{advice}</div>}
        </div> */}

        {detectedObjects.length > 0 && (
          <div style={{ background: '#111', padding: '20px', borderRadius: '4px' }}>
            <label style={{ fontSize: '11px', color: '#888' }}>SEISMIC INTENSITY (Mw)</label>
            <input 
                type="range" min="0" max="9" step="0.1" 
                style={{ width: '100%', accentColor: '#00ffcc', marginTop: '10px' }} 
                value={magnitude} 
                onChange={async (e) => {
                const val = e.target.value;
                setMagnitude(val);
                await fetch("/api/update_magnitude", {
                  method: "POST",
                  headers: {"Content-Type": "application/json"},
                  body: JSON.stringify({magnitude: val})
                });
              }}
              />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', color: '#00ffcc' }}>
              <span>0</span><span style={{ 
                color: 'white', 
                border: '1px solid #00ffcc', 
                padding: '2px 8px', 
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>{magnitude}</span><span>9</span>
            </div>
            <button 
                onClick={() => setMagnitude(0)} 
                style={{ marginTop: '20px', width: '100%', padding: '10px', background: '#222', color: '#fff', border: '1px solid #444', cursor: 'pointer' }}
            >
                STOP SIMULATION
            </button>
            <button onClick={getAdvice} className="mt-8 bg-blue-600 p-4 w-full rounded-xl text-2xl font-bold">
              Get Improvements
            </button>
            
            {advice && <div className="mt-4 p-6 bg-gray-800 rounded-lg border-l-4 border-blue-500">{advice}</div>}
          </div>
        )}
      </div>

      <Canvas shadows camera={{ position: [10, 10, 10], fov: 45 }}>
        <Sky sunPosition={[100, 10, 100]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[20, 20, 20]} castShadow intensity={1.5} />

        <Suspense fallback={null}>
          {previewImage}

          <Physics gravity={[0, -9.81, 0]}>
            <Room magnitude={magnitude} />

            {detectedObjects.map((obj, i) => {
              const density = DENSITIES[obj.type] || DENSITIES.default
              const mass = obj.size[0] * obj.size[1] * obj.size[2] * density

              return (
                <RigidBody
                  key={`${obj.type}-${i}`}
                  position={[obj.x, obj.size[1] / 2, obj.z]}
                  colliders="cuboid"
                  mass={mass}
                  restitution={0.1}
                  friction={1.0}
                >
                  <mesh castShadow>
                    <boxGeometry args={obj.size} />
                    <meshStandardMaterial color={obj.color} metalness={0.5} roughness={0.2} />
                  </mesh>
                  {/* Visual Label */}
                  <Text
                    position={[0, obj.size[1] / 2 + 0.5, 0]}
                    fontSize={0.4}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                  >
                    {obj.type.toUpperCase()}
                  </Text>
                </RigidBody>
              )
            })}
          </Physics>
        </Suspense>

        <OrbitControls makeDefault />
        <Environment preset="night" />
      </Canvas>
    </div>
  );

}

export default App;