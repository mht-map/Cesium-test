import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure static assets are served correctly
  experimental: {
    optimizePackageImports: ['cesium'],
  },
  
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        http: false,
        https: false,
        url: false,
        zlib: false,
      };
    }

    return config;
  },

  async headers() {
    return [
      {
        source: '/cesium/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
