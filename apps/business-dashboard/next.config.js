/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@ai-feedback/shared-types', '@ai-feedback/database'],
  experimental: {
    appDir: true
  }
};

module.exports = nextConfig;