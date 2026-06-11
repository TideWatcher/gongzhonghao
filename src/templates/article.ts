import type { TrendItem } from "../sources/types.js";

const FOOTER_STYLE = "color:#999;font-size:12px;border-top:1px solid #eee;margin-top:24px;padding-top:12px;";

/**
 * 在大模型生成的正文 HTML 基础上，拼接「资料来源」页脚，
 * 方便读者追溯原文，也提升内容透明度。
 */
export function renderArticleHtml(bodyHtml: string, sources: TrendItem[]): string {
  const sourceLinks = sources
    .map(
      (item, idx) =>
        `<li>${idx + 1}. <a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a>（${escapeHtml(item.source)}）</li>`,
    )
    .join("");

  const footer = `
<section style="${FOOTER_STYLE}">
  <p>本文由 AI Agent 自动整理生成，内容仅供参考，资料来源：</p>
  <ul>${sourceLinks}</ul>
</section>`;

  return `${bodyHtml}\n${footer}`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
