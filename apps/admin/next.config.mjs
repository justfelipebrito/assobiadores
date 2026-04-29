/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@batalha/ui', '@batalha/firebase', '@batalha/types', '@batalha/utils'],
};

export default nextConfig;
