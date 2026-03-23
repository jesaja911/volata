/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Mapbox GL CSS
  transpilePackages: ['mapbox-gl'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: '*.wikipedia.org' },
    ],
  },
}

module.exports = nextConfig
