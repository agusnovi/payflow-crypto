import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // These packages are optional peer deps or React Native deps that don't
    // exist in a browser/Node.js environment — tell webpack to ignore them
    config.externals.push(
      "@react-native-async-storage/async-storage",
      "pino-pretty",
      "lokijs",
      "encoding",
    )
    return config
  },
};

export default nextConfig;
