import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [magnitude, setMagnitude] = useState(6.0);
  const [advice, setAdvice] = useState("");
  const [detections, setDetections] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false); // New lock state
  const [mode] = useState(new URLSearchParams(window.location.search).get("mode") || "laptop");

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
      imageSrc = null
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
    <div className="p-10 bg-gray-900 text-white min-h-screen">
      <h1 className="text-4xl font-bold mb-8">Seismic Command Center</h1>
      
      {/* 1. Dashboard Visualization (Instead of Webcam) */}
      <div className="grid grid-cols-2 gap-8">
        <div className="bg-black p-4 rounded-xl border border-blue-500">
          <h2 className="mb-4">Live Object Stream</h2>
          <ul>
            {detections.map(d => (
              <li key={d.id} className={d.risk > 50 ? "text-red-400" : "text-green-400"}>
                {d.label}: {d.risk}% Fall Risk
              </li>
            ))}
          </ul>
        </div>

        {/* 2. Controls */}
        <div>
          <label className="block mb-4 text-xl">Simulate Intensity: {magnitude}</label>
          <input 
            type="range" min="4" max="9" step="0.1" 
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
            Generate AI Remediation
          </button>
          
          {advice && <div className="mt-4 p-6 bg-gray-800 rounded-lg border-l-4 border-blue-500">{advice}</div>}
        </div>
      </div>
    </div>
  );

}

export default App;