import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'tesseract.js',
    'pdf-parse',
    'pdfjs-dist',
    '@napi-rs/canvas',
  ],
};

export default nextConfig;
