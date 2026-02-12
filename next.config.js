// next.config.js
console.log('--- Lendo next.config.js (ESM) ---', new Date().toISOString());

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    // Em desenvolvimento, desabilita o otimizador para evitar 403 de CDNs (fbcdn/instagram).
    // Em produção, continua usando o otimizador normalmente.
    unoptimized: process.env.NODE_ENV === 'development',
    // Reduz custo de transformações no Vercel:
    // - menos variantes geradas
    // - apenas WebP como formato otimizado
    formats: ['image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 31, // 31 dias
    deviceSizes: [360, 640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

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
      {
        protocol: 'https',
        hostname: 'lookaside.instagram.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lookaside.fbsbx.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'platform-lookaside.fbsbx.com',
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
    serverActions: true,
    outputFileTracingIncludes: {
      '/app/**/*': ['./src/app/lib/**/*.md'],
      '/api/mediakit/[token]/pdf': [
        './node_modules/playwright-core/.local-browsers/**/*',
        './node_modules/playwright/.local-browsers/**/*',
      ],
    },
  },

  async redirects() {
    return [
      {
        source: '/dashboard/proposals',
        has: [{ type: 'query', key: 'view', value: 'sent' }],
        destination: '/campaigns?tab=sent',
        permanent: true,
      },
      {
        source: '/dashboard/proposals',
        has: [{ type: 'query', key: 'view', value: 'ai' }],
        destination: '/campaigns?tab=analysis',
        permanent: true,
      },
      {
        source: '/dashboard/proposals',
        destination: '/campaigns',
        permanent: true,
      },
      {
        source: '/dashboard/home',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/dashboard/media-kit',
        destination: '/media-kit',
        permanent: true,
      },
      {
        source: '/dashboard/afiliados',
        destination: '/affiliates',
        permanent: true,
      },
      {
        source: '/dashboard/settings',
        destination: '/settings',
        permanent: true,
      },
      {
        source: '/dashboard/billing',
        destination: '/settings/billing',
        permanent: true,
      },
    ];
  },
};

console.log('--- Configuração de images (ESM):', JSON.stringify(nextConfig.images, null, 2));
export default nextConfig;
