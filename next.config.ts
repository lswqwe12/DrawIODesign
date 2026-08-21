import type { NextConfig } from "next";

/**
 * GitHub Pages 静态部署配置。
 *
 * - output: "export"：将应用静态导出到 out/ 目录，供静态托管（GitHub Pages 等）使用。
 *   注意：静态导出无法运行服务端 Route Handler（如 /api/ai/*），因此 AI 能力已改为
 *   浏览器直连 DeepSeek（见 src/services/aiClient.ts），不再依赖服务端代理。
 * - basePath / assetPrefix：GitHub Pages 项目站点通常部署在 /仓库名/ 子路径下，
 *   通过构建时环境变量 NEXT_PUBLIC_BASE_PATH 注入；用户站点或自定义域名留空即可。
 * - images.unoptimized：静态导出不支持 next/image 优化，必须关闭。
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
