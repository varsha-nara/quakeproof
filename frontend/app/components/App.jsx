"use client"
import React, { useRef, useState, useEffect, Suspense } from 'react';
import Webcam from 'react-webcam';
import { Canvas, useFrame } from '@react-three/fiber'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { OrbitControls, Environment, Sky, Grid, Text } from '@react-three/drei'

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
const BACKEND_URL = process.env.BACKEND_URL;

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null)
  const [detectedObjects, setDetectedObjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("Waiting for video upload...")

  const [mode, setMode] = useState("laptop");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMode(params.get("mode") || "laptop");
  }, []);

  async function generateRoomData(prompt, frames) {
    const res = await fetch(`${BACKEND_URL}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, frames })
    });
    const data = await res.json();
    if (data.text) return data.text;
    throw new Error(data.error || "Unknown AI error");
  }

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

      const text = await generateRoomData(prompt, frames)
      const jsonMatch = text.match(/\[.*\]/s)
      if (!jsonMatch) throw new Error("Invalid AI Spatial Response")

      const parsed = JSON.parse(jsonMatch[0])
      
      const processed = parsed.map(obj => ({
        ...obj,
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
    if (!webcamRef.current) {
      setTimeout(processFrame, 500);
      return;
    }

    if (isProcessing) return;

    setIsProcessing(true);
    try {
      const imageSrc = webcamRef.current.getScreenshot({
        width: 320,
        height: 240
      });

      if (imageSrc) {
        const response = await fetch(`${BACKEND_URL}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

  useEffect(() => {
    processFrame();
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
    const res = await fetch(`${BACKEND_URL}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ detections: detectedObjects.map(obj => obj.type) })
    });
    const data = await res.json();
    setAdvice(data.advice);
  };

  useEffect(() => {
    const interval = setInterval(processFrame, 500);
    return () => clearInterval(interval);
  }, [magnitude]);

  useEffect(() => {
    const sync = async () => {
      const res = await fetch(`${BACKEND_URL}/state`);
      const state = await res.json();
      
      if (mode === "phone") {
        setMagnitude(state.magnitude);
      }

      if (mode !== "phone" && state.detections) {
        setDetections(state.detections);
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
    <div style={{ width: '100vw', height: '100vh', background: '#050505', overflow: 'hidden', fontFamily: 'monospace', position: 'relative', marginTop: '0' }}>
      {/* Sidebar UI */}
      <div style={{
        left: '20px', 
        top: '20px', 
        position: 'absolute', 
        zIndex: 10, 
        padding: '30px', 
        color: 'white',
        background: 'rgba(10,10,10,0.85)', 
        width: '30%',
        borderRight: '1px solid #333', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px',
        maxHeight: 'calc(100vh - 40px)',
        pointerEvents: 'auto',
        overflowY: 'auto',
      }}>
        <h1 style={{ color: '#00ffcc', letterSpacing: '4px', fontSize: '22px', margin: 0 }}>QUAKEPROOF</h1>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, #00ffcc, transparent)' }} />
        
        <div style={{ padding: '15px', background: '#111', borderRadius: '4px', border: '1px solid #222' }}>
          <input 
            ref={(el) => { if (el) window.fileInput = el; }}
            type="file" 
            accept="video/*" 
            onChange={(e) => e.target.files[0] && analyzeVideo(e.target.files[0])} 
            style={{ display: 'none' }} 
            id="video-upload"
          />
          <button 
            onClick={() => document.getElementById('video-upload').click()}
            style={{ 
              display: 'block', 
              width: '100%', 
              padding: '12px', 
              background: '#222', 
              color: '#00ffcc', 
              textAlign: 'center', 
              cursor: 'pointer',
              border: '1px solid #00ffcc',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            UPLOAD ROOM VIDEO
          </button>
          <p style={{ fontSize: '11px', color: loading ? '#ffcc00' : '#00ffcc', marginTop: '10px', textAlign: 'center' }}>{status}</p>
        </div>

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
                await fetch(`${BACKEND_URL}/update_magnitude`, {
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
                style={{ marginTop: '20px', width: '100%', padding: '10px', background: '#222', color: '#fff', border: '1px solid #444', cursor: 'pointer', borderRadius: '4px' }}
            >
                STOP SIMULATION
            </button>
            <button onClick={getAdvice} style={{ marginTop: '20px', width: '100%', padding: '16px', background: '#00d492', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold' }}>
              Get Improvements
            </button>
            
            {advice && <div style={{ marginTop: '16px', padding: '24px', maxHeight: '200px', overflowY: 'auto', background: '#1f2937', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>{advice}</div>}
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
                  position={[obj.x, (obj.size[1] / 2) + 0.1, obj.z]}
                  colliders="cuboid"
                  mass={mass}
                  restitution={0.1}
                  friction={1.0}
                  type="dynamic"
                  linearVelocity={[0, 0, 0]}
                  angularVelocity={[0, 0, 0]}
                  gravityScale={1}
                >
                  <mesh castShadow>
                    <boxGeometry args={obj.size} />
                    <meshStandardMaterial color={obj.color} metalness={0.5} roughness={0.2} />
                  </mesh>
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

        <OrbitControls makeDefault target={[0, 0, 0]} />
        <Environment preset="night" />
      </Canvas>
    </div>
  );

}

export default App;