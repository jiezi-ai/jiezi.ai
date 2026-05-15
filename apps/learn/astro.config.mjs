import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [
    starlight({
      title: "解字学堂",
      defaultLocale: "root",
      locales: {
        root: { label: "简体中文", lang: "zh-CN" },
      },
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/jiezi-ai/grant" },
        { icon: "x.com", label: "X", href: "https://x.com/yan5xu" },
        { icon: "external", label: "jiezi.ai", href: "https://jiezi.ai" },
      ],
      sidebar: [
        {
          label: "开始",
          items: [
            { label: "欢迎", slug: "getting-started/welcome" },
            { label: "环境配置", slug: "getting-started/setup" },
          ],
        },
        {
          label: "教程",
          items: [
            { label: "第一个 AI 项目", slug: "guides/first-project" },
            { label: "AI 编程工作流", slug: "guides/workflow" },
            { label: "从 0 到 50 Star", slug: "guides/zero-to-50-stars" },
          ],
        },
        {
          label: "资源",
          items: [
            { label: "推荐工具", slug: "resources/tools" },
            { label: "学习资料", slug: "resources/reading" },
          ],
        },
      ],
      customCss: [],
    }),
  ],
});
