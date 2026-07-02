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
    cpus: 1,
    webpackMemoryOptimizations: true,
  },
  webpack: (config) => {
    config.resolve.symlinks = false
    return config
  },
}

export default nextConfig
