import { config } from "../config/index.js";
import { fetchAllTrends } from "../sources/index.js";
import type { TrendItem } from "../sources/types.js";
import { ContentGenerator } from "../services/ai/contentGenerator.js";
import { WechatClient } from "../services/wechat/wechatClient.js";
import { historyStore } from "../services/store/historyStore.js";
import { renderArticleHtml } from "../templates/article.js";
import { logger } from "../utils/logger.js";

export interface PipelineResult {
  items: TrendItem[];
  title: string;
  digest: string;
  draftMediaId?: string;
  dryRun: boolean;
}

/**
 * 完整运营流水线：
 * 1. 抓取多数据源的热点资讯
 * 2. 过滤掉已经发布过的内容
 * 3. 调用大模型生成图文文章
 * 4. （非 dry-run）上传封面 + 创建公众号草稿
 * 5. 记录已处理的资讯，避免重复
 */
export async function runPublishPipeline(): Promise<PipelineResult> {
  logger.info("开始抓取热点资讯...");
  const allItems = await fetchAllTrends(config.sources.fetchLimit);

  const unseenItems = await historyStore.filterUnseen(allItems);
  logger.info(`抓取到 ${allItems.length} 条，去重后剩余 ${unseenItems.length} 条`);

  const selected = unseenItems.slice(0, config.sources.articleItemCount);
  if (selected.length === 0) {
    throw new Error("没有可用的新资讯，跳过本次发布");
  }

  logger.info("调用大模型生成文章...");
  const generator = new ContentGenerator();
  const article = await generator.generateArticle(selected);

  const contentHtml = renderArticleHtml(article.contentHtml, selected);

  const result: PipelineResult = {
    items: selected,
    title: article.title,
    digest: article.digest,
    dryRun: config.dryRun,
  };

  if (config.dryRun) {
    logger.info("DRY_RUN=true，跳过微信发布步骤", { title: article.title, digest: article.digest });
    return result;
  }

  if (!config.wechat.defaultCover) {
    throw new Error("未配置 WECHAT_DEFAULT_COVER，无法创建草稿封面");
  }

  const wechat = new WechatClient();
  logger.info("上传封面素材...");
  const thumbMediaId = await wechat.uploadThumbMedia(config.wechat.defaultCover);

  logger.info("创建公众号草稿...");
  const draftMediaId = await wechat.addDraft({
    title: article.title,
    digest: article.digest,
    content: contentHtml,
    thumbMediaId,
  });

  result.draftMediaId = draftMediaId;

  await historyStore.markAsPublished(selected.map((item) => item.id));

  return result;
}
