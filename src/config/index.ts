import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`缺少必要的环境变量: ${name}`);
  }
  return value;
}

function bool(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true" || value === "1";
}

export const config = {
  llm: {
    apiKey: process.env.LLM_API_KEY ?? "",
    baseURL: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.LLM_MODEL ?? "gpt-4o-mini",
  },
  wechat: {
    appId: process.env.WECHAT_APP_ID ?? "",
    appSecret: process.env.WECHAT_APP_SECRET ?? "",
    author: process.env.WECHAT_AUTHOR ?? "AI趋势速递",
    defaultCover: process.env.WECHAT_DEFAULT_COVER ?? "",
  },
  sources: {
    enabled: (process.env.SOURCES ?? "github_trending,hacker_news,crypto_news")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    fetchLimit: Number(process.env.SOURCE_FETCH_LIMIT ?? 5),
    articleItemCount: Number(process.env.ARTICLE_ITEM_COUNT ?? 6),
  },
  schedule: {
    cron: process.env.CRON_SCHEDULE ?? "30 10 * * *",
    timezone: process.env.TZ ?? "Asia/Shanghai",
  },
  dryRun: bool("DRY_RUN", false),
  dataDir: process.env.DATA_DIR ?? "./data",
};

export { required };
