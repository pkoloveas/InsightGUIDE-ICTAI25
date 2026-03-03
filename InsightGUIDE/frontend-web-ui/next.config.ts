import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  future: { webpack5: true },
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV !== "production",
  },
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV !== "production",
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
};

export default nextConfig;
