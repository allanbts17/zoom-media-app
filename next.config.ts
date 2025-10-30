import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🔧 Mantienes el React Compiler (nuevo en Next 14)
  reactCompiler: true,

  // 🔀 Rewrites para redirigir peticiones /api al backend (localhost:3000)
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3000/api/:path*", // backend
      },
    ];
  },
};

export default nextConfig;
