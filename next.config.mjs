/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "/uxd",
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
