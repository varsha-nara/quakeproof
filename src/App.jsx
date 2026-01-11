import React, { useState, useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { OrbitControls, Environment, Sky, Grid, useTexture, Text } from '@react-three/drei'
import { GoogleGenerativeAI } from "@google/generative-ai"

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(API_KEY)

// Physics constants: How heavy is the material? (kg per cubic meter)
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

export default function App() {
  const [magnitude, setMagnitude] = useState(0)
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

      setStatus("Gemini 2.5 Flash: Mapping Room...")

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
        <h1 style={{ color: '#00ffcc', letterSpacing: '4px', fontSize: '22px', margin: 0 }}>QUAKEPROOF AI</h1>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, #00ffcc, transparent)' }} />
        
        <div style={{ padding: '15px', background: '#111', borderRadius: '4px', border: '1px solid #222' }}>
          <input type="file" accept="video/*" onChange={(e) => e.target.files[0] && analyzeVideo(e.target.files[0])} style={{ width: '100%' }} />
          <p style={{ fontSize: '12px', color: loading ? '#ffcc00' : '#00ffcc', marginTop: '10px' }}>{status}</p>
        </div>

        {detectedObjects.length > 0 && (
          <div style={{ background: '#111', padding: '20px', borderRadius: '4px' }}>
            <label style={{ fontSize: '11px', color: '#888' }}>SEISMIC INTENSITY (Mw)</label>
            <input 
                type="range" min="0" max="9.5" step="0.1" 
                style={{ width: '100%', accentColor: '#00ffcc', marginTop: '10px' }} 
                value={magnitude} 
                onChange={(e) => setMagnitude(parseFloat(e.target.value))} 
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', color: '#00ffcc' }}>
              <span>0</span><span>{magnitude}</span><span>9.5</span>
            </div>
            <button 
                onClick={() => setMagnitude(0)} 
                style={{ marginTop: '20px', width: '100%', padding: '10px', background: '#222', color: '#fff', border: '1px solid #444', cursor: 'pointer' }}
            >
                STOP SIMULATION
            </button>
          </div>
        )}
      </div>

      <Canvas shadows camera={{ position: [8, 8, 8], fov: 45 }}>
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
                  position={[obj.x, obj.size[1] / 2 + 3, obj.z]}
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
  )
}