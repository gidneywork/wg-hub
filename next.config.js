/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the app to be embedded in iframes for TV display mode
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
