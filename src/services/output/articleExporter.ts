import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../../config/index.js";
import type { TrendItem } from "../../sources/types.js";
import { logger } from "../../utils/logger.js";

export interface ExportableArticle {
  title: string;
  digest: string;
  contentHtml: string;
}

/**
 * 将生成的文章导出为本地 HTML 文件，方便复制粘贴到公众号网页版图文编辑器手动发布。
 * 适用于个人未认证订阅号等无法调用草稿箱 API 的场景。
 */
export async function exportArticleToFile(
  article: ExportableArticle,
  sources: TrendItem[],
): Promise<string> {
  const outputDir = join(config.dataDir, "articles");
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = join(outputDir, `${timestamp}.html`);

  const sourceList = sources
    .map((item) => `<li>${escapeHtml(item.title)} - <a href="${escapeHtml(item.url)}">${escapeHtml(item.url)}</a></li>`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(article.title)}</title>
</head>
<body>
<h1>标题：${escapeHtml(article.title)}</h1>
<p><strong>摘要：</strong>${escapeHtml(article.digest)}</p>
<hr />
<!-- 以下内容可直接复制到公众号图文编辑器 -->
${article.contentHtml}
<hr />
<h3>资料来源</h3>
<ul>
${sourceList}
</ul>
</body>
</html>
`;

  await writeFile(filePath, html, "utf-8");
  logger.info(`文章已导出到本地文件: ${filePath}`);
  return filePath;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
