import axios from "axios";
import type { TrendItem, TrendSource } from "./types.js";
import { hashId } from "../utils/hash.js";
import { logger } from "../utils/logger.js";

interface CryptoCompareNewsItem {
  id: string;
  title: string;
  url: string;
  body?: string;
  source?: string;
  published_on?: number;
}

interface CryptoCompareNewsResponse {
  Data?: CryptoCompareNewsItem[];
}

/**
 * 抓取 CryptoCompare 的免费新闻接口（无需 API Key），
 * 作为 Crypto / Web3 应用相关热点的数据源。
 */
export class CryptoNewsSource implements TrendSource {
  readonly name = "crypto_news";

  async fetch(limit: number): Promise<TrendItem[]> {
    const { data } = await axios.get<CryptoCompareNewsResponse>(
      "https://min-api.cryptocompare.com/data/v2/news/",
      {
        params: { lang: "EN" },
        timeout: 15000,
      },
    );

    const items: TrendItem[] = (data.Data ?? []).slice(0, limit).map((item) => ({
      id: hashId("crypto_news", item.id),
      title: item.title,
      url: item.url,
      summary: item.body,
      source: this.name,
      score: item.published_on,
      fetchedAt: new Date().toISOString(),
    }));

    logger.info(`CryptoNewsSource 抓取到 ${items.length} 条`);
    return items;
  }
}
