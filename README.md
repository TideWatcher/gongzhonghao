# 公众号自动化运营 AI Agent

参考 [liyown/ai-trend-publish](https://github.com/liyown/ai-trend-publish) 的思路，实现一个轻量级的
**自动抓取热点 → AI 生成图文 → 自动创建微信公众号草稿** 的自动化运营 Agent。

## 整体架构

```
┌──────────────┐     ┌────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  数据源 Sources │ --> │  历史去重 Store  │ --> │  AI 内容生成 LLM   │ --> │  微信草稿 WeChat   │
│ GitHub Trending│     │ data/history.json│    │ ContentGenerator │     │  Draft API         │
│ Hacker News    │     │ 避免重复发布      │     │ 生成标题/摘要/正文 │     │ 上传封面+创建草稿   │
└──────────────┘     └────────────────┘     └──────────────────┘     └───────────────────┘
        ▲                                                                        │
        │                                                                        ▼
┌──────────────────────────────┐                                     人工在公众号后台预览/群发
│  调度器 Scheduler (node-cron)  │
│  按 CRON_SCHEDULE 周期触发      │
└──────────────────────────────┘
```

### 模块说明

- `src/sources/`：数据源抓取层，每个数据源实现统一的 `TrendSource` 接口（`fetch(limit)`），
  当前内置 `github_trending`（GitHub 每日趋势仓库）与 `hacker_news`（HackerNews 热门话题），
  可按需扩展新增数据源（如微博热搜、AI 资讯站点、RSS 等）。
- `src/services/store/historyStore.ts`：基于本地 JSON 文件的去重记录，避免同一条资讯被重复整理发布。
- `src/services/ai/contentGenerator.ts`：调用大模型（兼容 OpenAI API 的服务，如 OpenAI / DeepSeek /
  通义千问 / Moonshot 等），将多条资讯改写整理为一篇结构化的公众号图文文章（标题 + 摘要 + 正文 HTML）。
- `src/templates/article.ts`：在 AI 生成正文的基础上拼接「资料来源」页脚，提升内容可追溯性。
- `src/services/wechat/wechatClient.ts`：微信公众号「草稿箱」API 封装，包含
  - `access_token` 获取与缓存
  - 封面图片上传为永久素材
  - 创建图文草稿（`draft/add`）

  **注意**：出于安全考虑，Agent 默认仅创建草稿，不会自动群发，最终发布需运营人员在公众号后台
  「草稿箱」中预览确认后手动发布。
- `src/pipeline/publishPipeline.ts`：编排以上各步骤的完整流水线。
- `src/scheduler/cron.ts`：基于 `node-cron` 的定时任务，按 `CRON_SCHEDULE` 周期自动运行流水线。
- `src/index.ts`：CLI 入口，支持 `run`（执行一次）与 `schedule`（启动常驻定时任务）。

## 快速开始

```bash
npm install
cp .env.example .env
# 编辑 .env，填写大模型 API Key、微信公众号 AppID/AppSecret 等

# 本地调试（不发布到微信，仅打印生成的文章信息）
DRY_RUN=true npm run dev

# 正式运行一次（会创建微信公众号草稿）
npm run dev

# 启动定时任务，按 CRON_SCHEDULE 周期自动运行
npm run schedule
```

## 环境变量说明

详见 `.env.example`，关键配置：

| 变量 | 说明 |
| --- | --- |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | 大模型服务配置，兼容 OpenAI SDK 的服务均可 |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | 微信公众号开发者凭证（需在公众号后台「开发-基本配置」中获取，并将服务器 IP 加入白名单） |
| `WECHAT_DEFAULT_COVER` | 草稿封面图片（本地路径或可下载 URL） |
| `SOURCES` | 启用的数据源，逗号分隔 |
| `SOURCE_FETCH_LIMIT` | 每个数据源抓取条数 |
| `ARTICLE_ITEM_COUNT` | 每篇文章合并的资讯条数 |
| `CRON_SCHEDULE` | 定时任务 cron 表达式 |
| `DRY_RUN` | `true` 时跳过微信发布，仅本地生成内容用于调试 |

## 扩展方向

- 新增数据源：实现 `TrendSource` 接口并在 `src/sources/index.ts` 的 `REGISTRY` 中注册。
- 多账号/多主题：可基于当前流水线封装多套配置（不同 `SOURCES`、不同 prompt、不同公众号凭证），
  分别调度。
- 内容质量把控：可在 `ContentGenerator` 之后增加人工审核环节（如先发送到飞书/企业微信群审核，
  确认后再调用 `addDraft`）。
- 配图：当前仅支持固定封面，可接入文生图服务为每篇文章/每个段落生成配图，并通过
  `material/add_material` 上传后插入正文。
