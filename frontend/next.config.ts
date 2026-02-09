import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://quakeproof.onrender.com/:path*', // Use 127.0.0.1 specifically
      },
    ]
  },
}

export default nextConfig;
