/**
 * Milkdown Crepe 编辑器包装。桌面双栏左侧编辑、右侧预览；移动端切换标签。
 * 切换草稿时必须 destroy 旧实例（避免监听器/状态泄漏）。
 *
 * 图片入口经 ImageBlock：onUpload 做 WebP/EXIF 预处理 + 上传，返回受保护预览 URL
 * （/api/v1/blog/assets/:id，发布时后端改写为 /blog/media/...）；
 * proxyDomURL 把受保护 URL 转为 Bearer fetch 的 Blob URL 供编辑器内显示，
 * 缓存并在 destroy 时统一 revoke。
 */
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { prepareImage, uploadImage } from "./image-utils";
import { fetchAssetBlob } from "./api-client";

const PROTECTED_PREFIX = "/api/v1/blog/assets/";

export interface EditorOptions {
  root: HTMLElement;
  defaultValue: string;
  onChange: (markdown: string) => void;
  /** 上传图片所需草稿 ID。 */
  draftId: number;
}

export class MilkdownEditor {
  private crepe: Crepe;
  private blobCache = new Map<string, string>();

  constructor(opts: EditorOptions) {
    const onUpload = (file: File): Promise<string> =>
      prepareImage(file).then(p => uploadImage(p, opts.draftId));
    this.crepe = new Crepe({
      root: opts.root,
      defaultValue: opts.defaultValue,
      features: {
        [Crepe.Feature.CodeMirror]: true,
        [Crepe.Feature.ListItem]: true,
        [Crepe.Feature.LinkTooltip]: true,
        [Crepe.Feature.ImageBlock]: true,
        [Crepe.Feature.Table]: true,
        [Crepe.Feature.Latex]: true,
        [Crepe.Feature.BlockEdit]: true,
        [Crepe.Feature.Toolbar]: true,
      },
      featureConfigs: {
        [Crepe.Feature.ImageBlock]: {
          onUpload,
          inlineOnUpload: onUpload,
          blockOnUpload: onUpload,
          proxyDomURL: (url: string) => this.proxyDomURL(url),
        },
      },
    });
    this.crepe.on(api => {
      api.markdownUpdated((_ctx, markdown) => opts.onChange(markdown));
    });
  }

  private async proxyDomURL(url: string): Promise<string> {
    if (!url.startsWith(PROTECTED_PREFIX)) return url;
    const cached = this.blobCache.get(url);
    if (cached) return cached;
    try {
      const blobUrl = await fetchAssetBlob(url);
      this.blobCache.set(url, blobUrl);
      return blobUrl;
    } catch {
      return url;
    }
  }

  async create(): Promise<void> {
    await this.crepe.create();
  }

  getMarkdown(): string {
    return this.crepe.getMarkdown();
  }

  async destroy(): Promise<void> {
    for (const u of this.blobCache.values()) URL.revokeObjectURL(u);
    this.blobCache.clear();
    try {
      await this.crepe.destroy();
    } catch {
      /* 忽略销毁错误 */
    }
  }
}
