import { runPublishPipeline } from "./pipeline/publishPipeline.js";
import { startScheduler } from "./scheduler/cron.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const command = process.argv[2] ?? "run";

  switch (command) {
    case "run": {
      const result = await runPublishPipeline();
      logger.info("执行完成", {
        title: result.title,
        digest: result.digest,
        itemCount: result.items.length,
        draftMediaId: result.draftMediaId,
        exportedFilePath: result.exportedFilePath,
        dryRun: result.dryRun,
      });
      break;
    }
    case "schedule": {
      startScheduler();
      // 保持进程常驻
      break;
    }
    default:
      console.log(`未知命令: ${command}\n可用命令: run | schedule`);
      process.exit(1);
  }
}

main().catch((err) => {
  logger.error("运行失败", err);
  process.exit(1);
});
