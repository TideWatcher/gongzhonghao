import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";

interface HistoryRecord {
  /** 已处理过的资讯 id 集合 */
  publishedIds: string[];
}

const HISTORY_FILE = join(config.dataDir, "history.json");
const MAX_HISTORY = 2000;

async function ensureFile(): Promise<void> {
  await mkdir(dirname(HISTORY_FILE), { recursive: true });
}

async function load(): Promise<HistoryRecord> {
  try {
    const raw = await readFile(HISTORY_FILE, "utf-8");
    return JSON.parse(raw) as HistoryRecord;
  } catch {
    return { publishedIds: [] };
  }
}

/**
 * 记录已经被用于生成文章的资讯 id，避免下次重复抓取同一条目。
 */
export class HistoryStore {
  private cache: HistoryRecord | null = null;

  private async getRecord(): Promise<HistoryRecord> {
    if (!this.cache) {
      this.cache = await load();
    }
    return this.cache;
  }

  async filterUnseen<T extends { id: string }>(items: T[]): Promise<T[]> {
    const record = await this.getRecord();
    const seen = new Set(record.publishedIds);
    return items.filter((item) => !seen.has(item.id));
  }

  async markAsPublished(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const record = await this.getRecord();
    const merged = [...record.publishedIds, ...ids];
    record.publishedIds = merged.slice(-MAX_HISTORY);

    await ensureFile();
    await writeFile(HISTORY_FILE, JSON.stringify(record, null, 2), "utf-8");
    logger.debug(`已记录 ${ids.length} 条历史记录`);
  }
}

export const historyStore = new HistoryStore();
