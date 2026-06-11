import axios from "axios";
import type { TrendItem, TrendSource } from "./types.js";
import { hashId } from "../utils/hash.js";
import { logger } from "../utils/logger.js";

interface HnItem {
  id: number;
  title: string;
  url?: string;
  score?: number;
  text?: string;
}

/**
 * 抓取 Hacker News 热门话题（topstories），适合作为 AI/科技圈热点的补充来源。
 */
export class HackerNewsSource implements TrendSource {
  readonly name = "hacker_news";

  private readonly baseUrl = "https://hacker-news.firebaseio.com/v0";

  async fetch(limit: number): Promise<TrendItem[]> {
    const { data: ids } = await axios.get<number[]>(`${this.baseUrl}/topstories.json`, {
      timeout: 15000,
    });

    const topIds = ids.slice(0, Math.max(limit * 2, limit));
    const items: TrendItem[] = [];

    for (const id of topIds) {
      if (items.length >= limit) break;
      try {
        const { data: item } = await axios.get<HnItem>(`${this.baseUrl}/item/${id}.json`, {
          timeout: 10000,
        });
        if (!item?.title) continue;

        items.push({
          id: hashId("hacker_news", String(item.id)),
          title: item.title,
          url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
          summary: item.text,
          source: this.name,
          score: item.score ?? 0,
          fetchedAt: new Date().toISOString(),
        });
      } catch (err) {
        logger.warn(`HackerNewsSource 获取 item ${id} 失败`, err);
      }
    }

    logger.info(`HackerNewsSource 抓取到 ${items.length} 条`);
    return items;
  }
}
