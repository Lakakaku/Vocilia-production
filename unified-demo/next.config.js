/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Optimize for demo purposes
  experimental: {
    optimizeFonts: true,
    optimizeImages: true
  },
  // PWA-like features for demo
  async rewrites() {
    return []
  },
  // Enable static optimization
  trailingSlash: false,
  
  // For demo deployment
  output: process.env.BUILD_MODE === 'export' ? 'export' : undefined,
  assetPrefix: process.env.NODE_ENV === 'production' ? '/ai-feedback-demo' : '',
  basePath: process.env.NODE_ENV === 'production' ? '/ai-feedback-demo' : '',
  
  // Image optimization for demo
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig