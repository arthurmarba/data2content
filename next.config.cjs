// next.config.cjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    dangerouslyAllowSVG: true,
    // contentDispositionType: 'attachment', // <--- COMENTE OU REMOVA
    // contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;", // <--- COMENTE OU REMOVA
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;