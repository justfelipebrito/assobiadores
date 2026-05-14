/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@batalha/ui', '@batalha/firebase', '@batalha/types', '@batalha/utils'],
  experimental: {
    outputFileTracingIncludes: {
      '/*': ['./node_modules/ffmpeg-static/ffmpeg'],
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },
};

export default nextConfig;
