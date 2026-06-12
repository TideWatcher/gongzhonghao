import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config/index.js";
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

      // 写入本次运行结果摘要，供 CI（如 GitHub Actions）读取后创建提醒 Issue 等用途
      await mkdir(config.dataDir, { recursive: true });
      await writeFile(
        join(config.dataDir, "last-run.json"),
        JSON.stringify(
          {
            title: result.title,
            digest: result.digest,
            itemCount: result.items.length,
            sources: result.items.map((item) => ({ title: item.title, url: item.url, source: item.source })),
            draftMediaId: result.draftMediaId,
            exportedFilePath: result.exportedFilePath,
            dryRun: result.dryRun,
            generatedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        "utf-8",
      );
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
