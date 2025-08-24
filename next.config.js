// next.config.js
console.log('--- Lendo next.config.js (ESM) ---', new Date().toISOString());

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    // Em desenvolvimento, desabilita o otimizador para evitar 403 de CDNs (fbcdn/instagram).
    // Em produção, continua usando o otimizador normalmente.
    unoptimized: process.env.NODE_ENV === 'development',

    remotePatterns: [
      // Avatares do Google
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      // Placeholders
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },

      // CDNs do Facebook/Instagram (específicos)
      {
        protocol: 'https',
        hostname: 'scontent-iad3-1.xx.fbcdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'scontent-iad3-2.xx.fbcdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'scontent.xx.fbcdn.net',
        pathname: '/**',
      },

      // Curingas para cobrir variações regionais
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.xx.fbcdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com',
        pathname: '/**',
      },

      // Ex.: imagens hospedadas no i.ibb.co
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
        pathname: '/**',
      },
    ],
  },

  // Mantido do seu arquivo
  experimental: {
    outputFileTracingIncludes: {
      '/app/**/*': ['./src/app/lib/**/*.md'],
    },
  },
};

console.log('--- Configuração de images (ESM):', JSON.stringify(nextConfig.images, null, 2));
export default nextConfig;
