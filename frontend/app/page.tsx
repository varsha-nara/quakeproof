"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";

interface Quake {
  id: string;
  mag: number;
  place: string;
  time: string;
}

export default function Home() {
  const [quakes, setQuakes] = useState<Quake[]>([]);

  useEffect(() => {
    const fetchQuakes = async () => {
      try {
        // Fetching M2.5+ earthquakes from the last 24 hours
        const response = await fetch(
          "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"
        );
        const data = await response.json();
        
        // Format the first 10 results
        const formattedQuakes = data.features.slice(0, 10).map((f: any) => ({
          id: f.id,
          mag: f.properties.mag,
          place: f.properties.place,
          time: new Date(f.properties.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
        
        setQuakes(formattedQuakes);
      } catch (error) {
        console.error("Error fetching seismic data:", error);
      }
    };

    fetchQuakes();
    const interval = setInterval(fetchQuakes, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen font-sans transition-colors">
    
      {/* Navigation Menu */}
      <nav className="fixed top-0 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-50 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Image className="dark:invert" src="/quake_proof.svg" alt="Logo" width={24} height={24} />
            <span className="font-bold tracking-tighter text-xl text-slate-900 dark:text-white uppercase">QuakeProof</span>
          </div>
          <ul className="flex gap-8 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <li><button onClick={() => scrollToSection('hero')} className="hover:text-orange-600 transition">Home</button></li>
            <li><button onClick={() => scrollToSection('about')} className="hover:text-orange-600 transition">About</button></li>
            <li><button onClick={() => scrollToSection('contact')} className="hover:text-orange-600 transition">Contact</button></li>
          </ul>
        </div>

        {/* Live Seismic Ticker with Real Data */}
        <div className="ticker-container bg-slate-900 dark:bg-orange-600 overflow-hidden py-1.5 border-y border-slate-800 dark:border-orange-500 cursor-help">
          <div className="animate-marquee whitespace-nowrap flex items-center gap-12 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
            {quakes.length > 0 ? (
              [...quakes, ...quakes].map((quake, index) => (
                <span key={`${quake.id}-${index}`} className="flex items-center gap-4">
                  <span className="text-orange-400 dark:text-slate-900 font-black">●</span> 
                  
                  {/* Magnitude Color Coding */}
                  <span className={quake.mag >= 4.5 ? "text-red-500 dark:text-white font-black underline decoration-2" : ""}>
                    M {quake.mag.toFixed(1)}
                  </span>
                  
                  <span className="opacity-90">{quake.place}</span>
                  <span className="opacity-60">({quake.time})</span>
                </span>
              ))
            ) : (
              <span>● Synchronizing with Global Seismic Network...</span>
            )}
          </div> 
        </div>
      </nav>

      <main className="flex flex-col items-center">
        
        {/* Section 1: Hero with Tectonic Gradient */}
        <section id="hero" className="relative flex min-h-screen w-full flex-col items-center justify-center px-6 overflow-hidden">
          {/* Background Gradient Layer */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-zinc-100 via-white to-orange-50 dark:from-zinc-900 dark:via-black dark:to-orange-950/20 animate-tectonic" />
          
          <div className="max-w-3xl w-full text-center sm:text-left">
            <h1 className="text-5xl md:text-7xl font-black leading-none tracking-tighter mb-6">
              STAY <span className="text-orange-600">GROUNDED.</span><br />
              STAY SAFE.
            </h1>
            <p className="max-w-md text-xl leading-relaxed text-zinc-600 dark:text-zinc-400 mb-10">
              Real-time seismic monitoring and structural safety alerts designed for the modern world.
            </p>
            <button 
              onClick={() => scrollToSection('about')}
              className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-full font-bold transition-all transform hover:scale-105 shadow-lg shadow-orange-600/20"
            >
              Explore Features
            </button>
          </div>
        </section>

        {/* Section 2: About (Clean White/Dark) */}
        <section id="about" className="flex min-h-screen w-full flex-col items-center justify-center px-6 bg-white dark:bg-zinc-950">
          <div className="max-w-4xl grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6 border-l-4 border-orange-600 pl-4">Seismic Integrity</h2>
              <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
                QuakeProof uses advanced sensors and tectonic data to provide 
                up-to-the-second information on ground stability. Our mission is 
                to simplify complex geological data into actionable safety steps.
              </p>
            </div>
            <div className="aspect-square bg-zinc-100 dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
               <span className="text-zinc-400 italic text-sm">[Data Visualization Placeholder]</span>
            </div>
          </div>
        </section>

        {/* Section 3: Contact */}
        <section id="contact" className="flex min-h-[60vh] w-full flex-col items-center justify-center px-6 bg-zinc-900 text-white">
          <h2 className="text-4xl font-bold mb-4">Prepare Your Home</h2>
          <p className="text-zinc-400 mb-8 max-w-lg text-center">
            Join households using QuakeProof to monitor structural health.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <input 
              type="email" 
              placeholder="Enter your email" 
              className="bg-zinc-800 border border-zinc-700 px-6 py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-600 w-64"
            />
            <button className="bg-orange-600 hover:bg-orange-500 px-8 py-3 rounded-full font-bold transition">
              Get Started
            </button>
          </div>
        </section>

      </main>

      <footer className="py-10 text-center text-sm text-zinc-400">
        Built with Next.js & Tailwind CSS
      </footer>
    </div>
  );
}
