/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'd2xsxph8kpxj0f.cloudfront.net',
        pathname: '/**',
      },
    ],
  },
}
module.exports = nextConfig
