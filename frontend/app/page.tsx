"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen font-sans transition-colors">
      <main className="flex flex-col items-center">
        
        {/* Section 1: Hero with Tectonic Gradient */}
        <section id="hero" className="relative flex min-h-screen w-full flex-col items-center justify-center px-6 overflow-hidden">
          {/* Background Gradient Layer */}
          <div className="absolute inset-0 -z-10 bg-linear-to-br from-slate-50 via-white to-emerald-50/50 dark:from-slate-950 dark:via-black dark:to-emerald-950/30 animate-tectonic" />
          
          <div className="max-w-3xl w-full text-center sm:text-left">
            <h1 className="text-5xl md:text-7xl font-black leading-none tracking-tighter mb-6">
              STAY <span className="text-emerald-500">GROUNDED.</span><br />
              STAY SAFE.
            </h1>
            <p className="max-w-md text-xl leading-relaxed text-zinc-600 dark:text-zinc-400 mb-10">
              Real-time seismic monitoring and structural safety alerts designed for the modern world.
            </p>
            <button 
              onClick={() => router.push("/quake")}
              className="bg-emerald-600 hover:bg-emerald-300 text-white px-8 py-4 rounded-full font-bold transition-all transform hover:scale-105 shadow-lg shadow-emerald-200/20"
            >
              Prepare Your Home
            </button>
          </div>
        </section>

        {/* Section 2: About (Clean White/Dark) */}
        <section id="about" className="flex min-h-screen w-full flex-col items-center justify-center px-6 bg-white dark:bg-zinc-950">
          <div className="max-w-4xl grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-black mb-6 border-l-4 border-emerald-500 pl-4">SEISMIC INTEGRITY</h2>
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
              className="bg-zinc-800 border border-zinc-700 px-6 py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-600 w-64"
            />
            <button className="bg-emerald-600 hover:bg-emerald-400 px-8 py-3 rounded-full font-bold transition">
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