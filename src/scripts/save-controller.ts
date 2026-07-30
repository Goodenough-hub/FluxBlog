/**
 * SaveController：把 Studio 自动保存逻辑抽成可测试单元。
 *
 * 解决审查 P1：debounce.flush() 不返回 Promise 导致发布/返回列表/切换文章时
 * 最后 1.5s 的编辑未保存。本类统一管理 debounce 计时、在途保存与 flush：
 * - schedule(input, baseVersion)：防抖触发保存（默认 1.5s）。
 * - flush()：立即触发挂起的保存并 await 在途保存，返回其结果。
 *
 * 冲突处理由注入的 save 回调决定：保存失败（含 409）应 reject，flush 会向上抛出，
 * 调用方（发布/切换）据此中止后续操作，避免基于陈旧内容发布。
 */
export interface SaveInput {
  title: string;
  slug: string;
  tags: string[];
  markdown: string;
}

export class SaveController {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: { input: SaveInput; baseVersion: number } | null = null;
  private inFlight: Promise<void> | null = null;
  private requeue = false;

  constructor(
    private save: (input: SaveInput, baseVersion: number) => Promise<void>,
    private ms = 1500,
  ) {}

  schedule(input: SaveInput, baseVersion: number): void {
    this.pending = { input, baseVersion };
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fire(), this.ms);
  }

  /** 是否有未保存的编辑（用于 beforeunload 提示）。 */
  get dirty(): boolean {
    return this.pending !== null;
  }

  private fire(): void {
    this.timer = null;
    if (!this.pending) return;
    const { input, baseVersion } = this.pending;
    this.inFlight = this.save(input, baseVersion)
      .then(() => {
        // 成功：清掉本次对应的 pending
        if (this.pending && sameInput(this.pending.input, input)) {
          this.pending = null;
        }
      })
      .catch(() => {
        // 失败：保留 pending 以便 flush 重试；在途结束后若有 requeue 再触发。
      })
      .finally(() => {
        this.inFlight = null;
        if (this.requeue) {
          this.requeue = false;
          this.fire();
        }
      });
  }

  /** 立即触发挂起保存并等待在途完成；若有 pending 则保存之。冲突会向上抛出。 */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.inFlight) await this.inFlight;
    if (this.pending) {
      const { input, baseVersion } = this.pending;
      this.pending = null;
      await this.save(input, baseVersion);
    }
  }
}

function sameInput(a: SaveInput, b: SaveInput): boolean {
  return (
    a.markdown === b.markdown &&
    a.title === b.title &&
    a.slug === b.slug &&
    a.tags.join(",") === b.tags.join(",")
  );
}
