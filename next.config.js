// next.config.js (USANDO SINTAXE ESM)
console.log("--- NOVO TESTE: Lendo next.config.js (ESM) ---", new Date().toISOString());

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Você pode manter ou remover para o teste inicial
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        // pathname: '/**', // Pode adicionar depois se a imagem funcionar
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        // pathname: '/**', // Pode adicionar depois
      },
    ],
    // Remova estas linhas por enquanto, elas eram do seu config antigo e podem causar problemas de exibição
    // dangerouslyAllowSVG: true,
    // contentDispositionType: 'attachment',
    // contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

console.log("--- NOVO TESTE: Configuração de images (ESM):", JSON.stringify(nextConfig.images, null, 2));
export default nextConfig; // Importante: usar export default