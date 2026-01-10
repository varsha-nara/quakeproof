"use client";
import Image from "next/image";

export default function Home() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black text-zinc-950 dark:text-zinc-50 transition-colors">
      
      {/* Navigation Menu */}
      <nav className="fixed top-0 w-full bg-white/70 dark:bg-black/70 backdrop-blur-md z-50 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex justify-between items-center">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={80}
            height={16}
            priority
          />
          <ul className="flex gap-6 text-sm font-medium">
            <li><button onClick={() => scrollToSection('hero')} className="hover:text-zinc-500 transition">Home</button></li>
            <li><button onClick={() => scrollToSection('about')} className="hover:text-zinc-500 transition">About</button></li>
            <li><button onClick={() => scrollToSection('contact')} className="hover:text-zinc-500 transition">Contact</button></li>
          </ul>
        </div>
      </nav>

      <main className="flex flex-col items-center">
        
        {/* Section 1: Hero (Your original content) */}
        <section id="hero" className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-16 sm:items-start">
          <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
            <h1 className="max-w-xs text-4xl font-semibold leading-tight tracking-tight">
              Simple. Clean. Minimal.
            </h1>
            <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              This page has been edited to include a sticky menu and smooth-scrolling sections while keeping your original Next.js aesthetic.
            </p>
          </div>
        </section>

        {/* Section 2: About */}
        <section id="about" className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-16 bg-white dark:bg-zinc-950 sm:items-start">
          <h2 className="text-3xl font-semibold mb-6">About the Site</h2>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            By using standard HTML IDs and the <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">scrollIntoView</code> API, 
            we can jump to different parts of this page effortlessly.
          </p>
        </section>

        {/* Section 3: Contact */}
        <section id="contact" className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-16 sm:items-start">
          <h2 className="text-3xl font-semibold mb-6">Get in Touch</h2>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400 mb-8">
            This is the final section. It uses the same width constraints as your original layout.
          </p>
          <a
            href="mailto:hello@example.com"
            className="flex h-12 items-center justify-center rounded-full border border-zinc-900 dark:border-zinc-50 px-8 transition-colors hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-50 dark:hover:text-black"
          >
            Email Me
          </a>
        </section>

      </main>

      <footer className="py-10 text-center text-sm text-zinc-400">
        Built with Next.js & Tailwind CSS
      </footer>
    </div>
  );
}
