import * as cheerio from "cheerio";
import axios from "axios";
import type { TrendItem, TrendSource } from "./types.js";
import { hashId } from "../utils/hash.js";
import { logger } from "../utils/logger.js";

/**
 * 抓取 GitHub Trending（每日趋势仓库），作为 AI/技术热点的数据源之一。
 */
export class GithubTrendingSource implements TrendSource {
  readonly name = "github_trending";

  async fetch(limit: number): Promise<TrendItem[]> {
    const url = "https://github.com/trending?since=daily";
    const { data: html } = await axios.get<string>(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TrendBot/1.0)" },
      timeout: 15000,
    });

    const $ = cheerio.load(html);
    const items: TrendItem[] = [];

    $("article.Box-row").each((_, el) => {
      if (items.length >= limit) return;

      const repo = $(el)
        .find("h2 a")
        .attr("href")
        ?.trim()
        .replace(/^\//, "");
      if (!repo) return;

      const description = $(el).find("p").first().text().trim();
      const starsText = $(el)
        .find('a[href$="/stargazers"]')
        .first()
        .text()
        .trim()
        .replace(/,/g, "");
      const stars = Number.parseInt(starsText, 10) || 0;

      items.push({
        id: hashId("github_trending", repo),
        title: repo,
        url: `https://github.com/${repo}`,
        summary: description,
        source: this.name,
        score: stars,
        fetchedAt: new Date().toISOString(),
      });
    });

    logger.info(`GithubTrendingSource 抓取到 ${items.length} 条`);
    return items;
  }
}
