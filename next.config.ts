import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🔧 Mantienes el React Compiler (nuevo en Next 14)
  reactCompiler: true,
  output: "export", // 👈 Genera una carpeta /out con HTML estático

  // 🔀 Rewrites para redirigir peticiones /api al backend (localhost:3000)
  // async rewrites() {
  //   return [
  //     {
  //       source: "/api/:path*",
  //       //destination: "http://localhost:3000/api/:path*", // backend
  //       destination: "https://us-central1-zoom-app-dev.cloudfunctions.net/api/:path*"
  //     },
  //   ];
  // },
};

export default nextConfig;
