import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@xenova/transformers", "onnxruntime-web"],
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-node$": false,
        "sharp$": false,
      };
    }
    return config;
  },
};

export default nextConfig;
