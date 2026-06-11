import axios from "axios";
import { readFile } from "node:fs/promises";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";

const API_BASE = "https://api.weixin.qq.com/cgi-bin";

interface AccessTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

interface UploadMediaResponse {
  media_id?: string;
  url?: string;
  errcode?: number;
  errmsg?: string;
}

export interface DraftArticle {
  title: string;
  author?: string;
  digest?: string;
  content: string;
  /** 封面图片的永久素材 media_id */
  thumbMediaId: string;
  contentSourceUrl?: string;
  showCoverPic?: 0 | 1;
}

interface AddDraftResponse {
  media_id?: string;
  errcode?: number;
  errmsg?: string;
}

/**
 * 微信公众号「草稿箱」相关接口的轻量封装。
 * 出于安全考虑，本 Agent 默认只创建草稿（draft），不会自动群发，
 * 最终发布需要管理员在公众号后台手动确认。
 */
export class WechatClient {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly appId: string = config.wechat.appId,
    private readonly appSecret: string = config.wechat.appSecret,
  ) {}

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.appId || !this.appSecret) {
      throw new Error("缺少微信公众号 WECHAT_APP_ID / WECHAT_APP_SECRET 配置");
    }

    const { data } = await axios.get<AccessTokenResponse>(`${API_BASE}/token`, {
      params: {
        grant_type: "client_credential",
        appid: this.appId,
        secret: this.appSecret,
      },
      timeout: 10000,
    });

    if (!data.access_token) {
      throw new Error(`获取微信 access_token 失败: ${data.errcode} ${data.errmsg}`);
    }

    this.accessToken = data.access_token;
    // 提前 60 秒过期，留出安全冗余
    this.tokenExpiresAt = Date.now() + ((data.expires_in ?? 7200) - 60) * 1000;
    return this.accessToken;
  }

  /**
   * 上传永久素材（图片），用于草稿封面。
   * @param filePathOrUrl 本地文件路径或可下载的 http(s) URL
   */
  async uploadThumbMedia(filePathOrUrl: string): Promise<string> {
    const token = await this.getAccessToken();

    let buffer: Buffer;
    if (/^https?:\/\//.test(filePathOrUrl)) {
      const res = await axios.get<ArrayBuffer>(filePathOrUrl, {
        responseType: "arraybuffer",
        timeout: 20000,
      });
      buffer = Buffer.from(res.data);
    } else {
      buffer = await readFile(filePathOrUrl);
    }

    const form = new FormData();
    form.append("media", new Blob([new Uint8Array(buffer)]), "cover.jpg");

    const { data } = await axios.post<UploadMediaResponse>(
      `${API_BASE}/material/add_material`,
      form,
      {
        params: { access_token: token, type: "image" },
        timeout: 30000,
      },
    );

    if (!data.media_id) {
      throw new Error(`上传封面素材失败: ${data.errcode} ${data.errmsg}`);
    }

    return data.media_id;
  }

  /**
   * 新建图文草稿，返回草稿 media_id。
   * 草稿创建后需登录公众号后台「草稿箱」中预览、审核并手动群发。
   */
  async addDraft(article: DraftArticle): Promise<string> {
    const token = await this.getAccessToken();

    const payload = {
      articles: [
        {
          title: article.title,
          author: article.author ?? config.wechat.author,
          digest: article.digest ?? "",
          content: article.content,
          content_source_url: article.contentSourceUrl ?? "",
          thumb_media_id: article.thumbMediaId,
          show_cover_pic: article.showCoverPic ?? 1,
          need_open_comment: 1,
          only_fans_can_comment: 0,
        },
      ],
    };

    const { data } = await axios.post<AddDraftResponse>(`${API_BASE}/draft/add`, payload, {
      params: { access_token: token },
      timeout: 20000,
    });

    if (!data.media_id) {
      throw new Error(`创建草稿失败: ${data.errcode} ${data.errmsg}`);
    }

    logger.info(`草稿创建成功，media_id=${data.media_id}`);
    return data.media_id;
  }
}
