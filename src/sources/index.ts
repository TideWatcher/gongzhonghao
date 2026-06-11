import type { TrendItem, TrendSource } from "./types.js";
import { GithubTrendingSource } from "./githubTrending.js";
import { HackerNewsSource } from "./hackerNews.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

export type { TrendItem, TrendSource };

const REGISTRY: Record<string, () => TrendSource> = {
  github_trending: () => new GithubTrendingSource(),
  hacker_news: () => new HackerNewsSource(),
};

export function getEnabledSources(): TrendSource[] {
  return config.sources.enabled
    .map((name) => {
      const factory = REGISTRY[name];
      if (!factory) {
        logger.warn(`未知数据源 "${name}"，已忽略`);
        return undefined;
      }
      return factory();
    })
    .filter((s): s is TrendSource => Boolean(s));
}

/**
 * 并行抓取所有启用的数据源，单个来源失败不影响其它来源。
 */
export async function fetchAllTrends(limit: number): Promise<TrendItem[]> {
  const sources = getEnabledSources();

  const results = await Promise.allSettled(sources.map((source) => source.fetch(limit)));

  const items: TrendItem[] = [];
  results.forEach((result, idx) => {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      logger.error(`数据源 "${sources[idx].name}" 抓取失败`, result.reason);
    }
  });

  // 按热度倒序排列
  items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return items;
}
