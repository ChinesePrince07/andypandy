/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/r2/:path*',
        destination: `${process.env.S3_CUSTOM_DOMAIN || 'https://pub-6d332a2be65d4bd2bb00662bba9cb4b0.r2.dev'}/:path*`,
      },
    ]
  },
}

export default nextConfig
