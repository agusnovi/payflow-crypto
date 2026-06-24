import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Replace missing optional/React Native deps with empty modules.
    // Setting alias to false tells webpack to stub them out silently.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
      "lokijs": false,
      "encoding": false,
    }
    return config
  },
};

export default nextConfig;
