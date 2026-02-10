"use client"
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from "next/navigation";

interface Quake {
  id: string;
  mag: number;
  place: string;
  time: string;
}

export default function Navbar() {
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

    const router = useRouter();

    const scrollToSection = (hash: string) => {
      router.push(`/#${hash}`);
    };

    return(
        <nav className="fixed top-0 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-50 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-1 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button onClick={() => scrollToSection('hero')}>
            <Image className="dark:invert" src="/file.svg" alt="Logo" width={120} height={120} style={{ marginTop: '-10px', marginBottom: '-10px' }}/>
            </button>
            <span className="font-bold tracking-tighter text-xl text-slate-900 dark:text-white uppercase"></span>
          </div>
          <ul className="flex gap-8 font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <li><button onClick={() => scrollToSection('hero')} className="hover:text-emerald-300 transition">Home</button></li>
            <li><button onClick={() => scrollToSection('about')} className="hover:text-emerald-300 transition">About</button></li>
            <li><button onClick={() => scrollToSection('contact')} className="hover:text-emerald-300 transition">Contact</button></li>
          </ul>
        </div>

        {/* Live Seismic Ticker with Real Data */}
        <div className="ticker-container bg-slate-900 dark:bg-emerald-500 overflow-hidden py-1.5 border-y border-slate-800 dark:border-emerald-500 cursor-help">
          <div className="animate-marquee whitespace-nowrap flex items-center gap-12 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
            {quakes.length > 0 ? (
              [...quakes, ...quakes].map((quake, index) => (
                <span key={`${quake.id}-${index}`} className="flex items-center gap-4">
                  <span className="text-emerald-500 dark:text-slate-900 font-black">●</span> 
                  
                  {/* Magnitude Color Coding */}
                  <span className={quake.mag >= 4.5 ? "text-emerald-300 dark:text-white font-black underline decoration-2" : ""}>
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
    );
}