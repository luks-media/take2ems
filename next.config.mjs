/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Avoid bundling native-heavy packages (helps Alpine `next build` + slimmer traces).
    serverComponentsExternalPackages: ['puppeteer', '@prisma/client'],
  },
};

export default nextConfig;
