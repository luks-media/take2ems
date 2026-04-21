/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Docker deploy: skip typecheck in image build to reduce memory pressure.
    // Keep local/CI type checks separately.
    ignoreBuildErrors: true,
  },
  experimental: {
    // Avoid bundling native-heavy packages (helps Alpine `next build` + slimmer traces).
    serverComponentsExternalPackages: ['puppeteer', '@prisma/client'],
  },
  webpack: (config, { dev }) => {
    // Small VPS / Docker: avoid OOM killer ("signal: killed") during `next build`.
    if (!dev) {
      config.parallelism = 1
    }
    return config
  },
}

export default nextConfig
