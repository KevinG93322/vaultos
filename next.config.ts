import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server treats localhost and 127.0.0.1 as different origins.
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [
      { source: "/console", destination: "/", permanent: false },
      { source: "/console/:path*", destination: "/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
