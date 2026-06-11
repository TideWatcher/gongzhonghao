export interface TrendItem {
  /** 唯一标识，用于去重（通常使用来源+链接的哈希） */
  id: string;
  /** 标题 */
  title: string;
  /** 原文链接 */
  url: string;
  /** 简介/摘要（来源原文，未经 AI 加工） */
  summary?: string;
  /** 数据来源标识，如 github_trending / hacker_news */
  source: string;
  /** 热度数值（star 数 / 分数等），用于排序 */
  score?: number;
  /** 抓取时间 */
  fetchedAt: string;
}

export interface TrendSource {
  /** 数据源唯一标识 */
  readonly name: string;
  /** 抓取最新热点列表 */
  fetch(limit: number): Promise<TrendItem[]>;
}
