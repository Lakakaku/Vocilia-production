/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  }
  // Deployment trigger: 2025-01-09T21:08:00Z
};

module.exports = nextConfig;