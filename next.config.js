// next.config.js
console.log("--- Lendo next.config.js (ESM) ---", new Date().toISOString());

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'scontent-iad3-2.xx.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: '**.xx.fbcdn.net',
      },
      // LINHA ADICIONADA: Permite carregar imagens de qualquer subdomínio da CDN do Instagram.
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com',
      },
    ],
  },
};

console.log("--- Configuração de images (ESM):", JSON.stringify(nextConfig.images, null, 2));
export default nextConfig;
