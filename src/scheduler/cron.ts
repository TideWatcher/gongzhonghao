import cron from "node-cron";
import { config } from "../config/index.js";
import { runPublishPipeline } from "../pipeline/publishPipeline.js";
import { logger } from "../utils/logger.js";

export function startScheduler(): void {
  if (!cron.validate(config.schedule.cron)) {
    throw new Error(`非法的 CRON_SCHEDULE 表达式: ${config.schedule.cron}`);
  }

  logger.info(`定时任务已启动，cron="${config.schedule.cron}" timezone=${config.schedule.timezone}`);

  cron.schedule(
    config.schedule.cron,
    async () => {
      logger.info("定时任务触发，开始执行发布流水线");
      try {
        const result = await runPublishPipeline();
        logger.info("流水线执行完成", {
          title: result.title,
          itemCount: result.items.length,
          draftMediaId: result.draftMediaId,
          dryRun: result.dryRun,
        });
      } catch (err) {
        logger.error("流水线执行失败", err);
      }
    },
    { timezone: config.schedule.timezone },
  );
}
