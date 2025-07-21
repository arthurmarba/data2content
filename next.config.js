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
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com',
      },
      // NOVO: Adicionado para permitir o carregamento da imagem de fundo do WhatsApp.
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
      },
    ],
  },
  // ▼▼▼ ADICIONE ESTE BLOCO ▼▼▼
  experimental: {
    // Esta opção diz ao Next.js para incluir arquivos que correspondem
    // a este padrão no pacote da função de servidor.
    outputFileTracingIncludes: {
      '/app/**/*': ['./src/app/lib/**/*.md'],
    },
  },
  // ▲▲▲ FIM DO BLOCO ADICIONADO ▲▲▲
};

console.log("--- Configuração de images (ESM):", JSON.stringify(nextConfig.images, null, 2));
export default nextConfig;