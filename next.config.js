/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Para Next.js 13+, podemos usar remotePatterns:
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',         // ou deixe sem essa propriedade
        pathname: '/**',  // aceita qualquer caminho após lh3.googleusercontent.com
      },
    ],
  },
};

module.exports = nextConfig;