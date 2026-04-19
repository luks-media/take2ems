/** @type {import('next').NextConfig} */
const nextConfig = {
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
