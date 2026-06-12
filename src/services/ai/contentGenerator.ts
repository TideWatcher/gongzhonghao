import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { config } from "../../config/index.js";
import type { TrendItem } from "../../sources/types.js";
import { logger } from "../../utils/logger.js";

export interface GeneratedArticle {
  /** 文章标题（用于公众号草稿 title 字段，建议 <= 64 字符） */
  title: string;
  /** 文章摘要（用于公众号草稿 digest 字段，建议 <= 120 字符） */
  digest: string;
  /** 正文 HTML（用于公众号草稿 content 字段） */
  contentHtml: string;
}

const SYSTEM_PROMPT = `你是一名资深的科技/AI 行业自媒体编辑，负责将多条英文或中文的科技热点资讯，
整理改写为一篇适合微信公众号发布的中文图文文章。

要求：
1. 风格通俗易懂、有吸引力，适当使用 emoji 增强可读性，但不要过度。
2. 文章需包含一个总体导语，然后按条目逐一介绍每条资讯，给出简要点评或解读。
3. 严禁直接照抄原文，须用自己的语言转述、总结。
4. 输出必须是合法 JSON，字段为：
   - title: 字符串，文章标题，吸引点击但不夸张，不超过 30 个汉字
   - digest: 字符串，一句话摘要，不超过 50 个汉字
   - contentHtml: 字符串，正文内容的 HTML 片段（可使用 <h2> <p> <strong> <a> <ul> <li> 等基础标签，
     不要包含 <html> <body> 等外层标签，不要使用 <script> 等危险标签）
5. contentHtml 中如引用原文链接，使用 <a href="...">查看原文</a> 的形式。
6. 直接输出 JSON 本身，不要使用 markdown 代码块包裹，不要输出 JSON 以外的任何文字说明。
7. 极其重要：title、digest、contentHtml 的文本内容中，禁止出现任何英文直引号字符 "（包括用于强调
   的场景），需要强调时请使用中文引号「」或“”的全角形式代替；HTML 属性的引号（如 href="..."）
   必须正常使用并正确转义为 \\"，不能省略。`;

/**
 * 从模型输出中提取 JSON 对象。
 * 部分模型（包括通过兼容层调用的 Anthropic 模型）即使被要求只输出 JSON，
 * 仍可能在外层包裹 ```json ... ``` 代码块或附带说明文字，这里做兼容处理。
 */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1);
  }

  return raw.trim();
}

function buildUserPrompt(items: TrendItem[]): string {
  const lines = items.map((item, idx) => {
    const parts = [
      `${idx + 1}. 标题：${item.title}`,
      `   来源：${item.source}`,
      `   链接：${item.url}`,
    ];
    if (item.summary) {
      parts.push(`   简介：${item.summary.slice(0, 500)}`);
    }
    if (item.score !== undefined) {
      parts.push(`   热度：${item.score}`);
    }
    return parts.join("\n");
  });

  return `请基于以下 ${items.length} 条今日科技/AI 热点资讯，生成一篇公众号图文文章：\n\n${lines.join("\n\n")}`;
}

export class ContentGenerator {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.baseURL,
    });
  }

  /**
   * 调用大模型，将多条资讯整理为一篇公众号文章。
   */
  async generateArticle(items: TrendItem[]): Promise<GeneratedArticle> {
    if (items.length === 0) {
      throw new Error("没有可用于生成文章的资讯条目");
    }

    const completion = await this.client.chat.completions.create({
      model: config.llm.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(items) },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("大模型未返回任何内容");
    }

    const finishReason = completion.choices[0]?.finish_reason;
    if (finishReason === "length") {
      logger.warn("大模型输出因达到 max_tokens 上限被截断，可能导致 JSON 不完整", { finishReason });
    }

    const jsonCandidate = extractJson(raw);

    let parsed: GeneratedArticle;
    try {
      parsed = JSON.parse(jsonCandidate) as GeneratedArticle;
    } catch (parseErr) {
      logger.warn("大模型返回的 JSON 格式有误，尝试自动修复", { error: (parseErr as Error).message });
      try {
        parsed = JSON.parse(jsonrepair(jsonCandidate)) as GeneratedArticle;
      } catch (repairErr) {
        logger.error("自动修复 JSON 失败", { raw });
        throw new Error(`解析大模型返回内容失败: ${(repairErr as Error).message}`);
      }
    }

    if (!parsed.title || !parsed.contentHtml) {
      throw new Error("大模型返回内容缺少必要字段 (title / contentHtml)");
    }

    return {
      title: parsed.title.slice(0, 64),
      digest: (parsed.digest ?? "").slice(0, 120),
      contentHtml: parsed.contentHtml,
    };
  }
}
