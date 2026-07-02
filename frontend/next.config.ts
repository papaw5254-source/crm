import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['localhost'],
  },
  experimental: {
    workerThreads: false,
  },
  webpack: (config) => {
    // Prevent webpack from resolving junctions to their real D: paths,
    // which would create invalid cross-drive relative paths.
    config.resolve.symlinks = false
    return config
  },
}

export default nextConfig
