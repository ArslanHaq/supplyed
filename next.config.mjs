/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.18.108", "192.168.100.90", "192.168.100.105","192.168.18.34"],
  output: "standalone",
  reactStrictMode: true,
  // Profile photos support 5 MiB; leave room for the multipart envelope.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  // The only next/image is already unoptimized. Keep the unused optimizer closed.
  images: { unoptimized: true },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
