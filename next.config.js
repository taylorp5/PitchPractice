/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Disable source maps in production for consistency with Vercel
  productionBrowserSourceMaps: false,
}

module.exports = nextConfig




