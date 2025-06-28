// next.config.js (USANDO SINTAXE ESM)
console.log("--- NOVO TESTE: Lendo next.config.js (ESM) ---", new Date().toISOString());

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Mantida sua configuração
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
      // ==================== INÍCIO DA CORREÇÃO ====================
      // Adiciona o novo padrão para a CDN do Instagram.
      // O uso de '**' como wildcard (curinga) permite carregar imagens
      // de qualquer subdomínio como 'scontent.cdninstagram.com'.
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com',
      },
      // ==================== FIM DA CORREÇÃO ======================
    ],
  },
};

console.log("--- NOVO TESTE: Configuração de images (ESM):", JSON.stringify(nextConfig.images, null, 2));
export default nextConfig; // Importante: usar export default
