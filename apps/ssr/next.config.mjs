// Allow next/image to load from the R2 public host (and a future custom domain
// set via R2_PUBLIC_BASE_URL). Without this, the admin dashboard's <Image> thumbnails
// are blocked ("hostname not configured").
const r2Host = (() => {
  try {
    return new URL(process.env.R2_PUBLIC_BASE_URL || '').hostname
  } catch {
    return null
  }
})()

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
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      ...(r2Host ? [{ protocol: 'https', hostname: r2Host }] : []),
    ],
  },
}

export default nextConfig
