import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pure client SPA → static export. Produces ./out (servable anywhere, and the
  // basis for wrapping as a desktop app via Electron/Tauri later).
  output: 'export',
  reactStrictMode: false,
  // The standalone app owns the Studio UI source locally and consumes shared
  // workspace packages directly.
  transpilePackages: ['najm-kit', 'najm-rag', 'najm-chatbot'],
};

export default nextConfig;
