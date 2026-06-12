import type { TrendItem, TrendSource } from "./types.js";
import { GithubTrendingSource } from "./githubTrending.js";
import { HackerNewsSource } from "./hackerNews.js";
import { CryptoNewsSource } from "./cryptoNews.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

export type { TrendItem, TrendSource };

const REGISTRY: Record<string, () => TrendSource> = {
  github_trending: () => new GithubTrendingSource(),
  hacker_news: () => new HackerNewsSource(),
  crypto_news: () => new CryptoNewsSource(),
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
 * 各数据源内部已按自身热度排序，这里按数据源轮流交叉合并（round-robin），
 * 避免某个来源的分数量级（如时间戳）压制其它来源，保证最终文章的来源多样性。
 */
export async function fetchAllTrends(limit: number): Promise<TrendItem[]> {
  const sources = getEnabledSources();

  const results = await Promise.allSettled(sources.map((source) => source.fetch(limit)));

  const perSourceItems: TrendItem[][] = results.map((result, idx) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    logger.error(`数据源 "${sources[idx].name}" 抓取失败`, result.reason);
    return [];
  });

  const items: TrendItem[] = [];
  const maxLength = Math.max(0, ...perSourceItems.map((list) => list.length));
  for (let i = 0; i < maxLength; i++) {
    for (const list of perSourceItems) {
      if (list[i]) items.push(list[i]);
    }
  }

  return items;
}
