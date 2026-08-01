/**
 * SaveController：Studio 自动保存的严格 single-flight 控制器。
 *
 * 不变量：
 * - 任意时刻最多一个 PATCH 在途（inFlight）。
 * - 新输入覆盖 pending，不并发发送；在途完成后立即保存最新 pending。
 * - schedule 在 blocked 态被忽略：冲突未解决前禁止保存。
 * - flush() 循环等待，直至 in-flight 与 pending 均空；blocked 时抛出，
 *   调用方（发布/切换）据此中止。
 *
 * 冲突（save reject）→ 进入 blocked，pending 保留供重试；用户解决后调
 * resolveConflict() 恢复 idle。onBlocked 回调用于触发冲突 UI。
 */
export interface SaveInput {
  title: string;
  slug: string;
  tags: string[];
  description: string;
  cover: string;
  markdown: string;
  visibility: "public" | "private";
}

type SaveState = "idle" | "saving" | "blocked";

export class SaveController {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: { input: SaveInput; baseVersion: number } | null = null;
  private inFlight: Promise<void> | null = null;
  private state: SaveState = "idle";

  constructor(
    private save: (input: SaveInput, baseVersion: number) => Promise<void>,
    private ms = 1500,
    private onBlocked?: (err: unknown) => void
  ) {}

  /** 有未保存编辑：pending 或在途或 blocked。 */
  get dirty(): boolean {
    return this.pending !== null || this.state !== "idle";
  }

  get isBlocked(): boolean {
    return this.state === "blocked";
  }

  schedule(input: SaveInput, baseVersion: number): void {
    if (this.state === "blocked") return; // 冲突未解决，禁止保存
    this.pending = { input, baseVersion };
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.pump(), this.ms);
  }

  private pump(): void {
    this.timer = null;
    if (this.inFlight || this.state === "blocked" || !this.pending) return;
    const { input, baseVersion } = this.pending;
    this.pending = null;
    this.state = "saving";
    this.inFlight = this.save(input, baseVersion)
      .catch(err => {
        // 冲突/失败：进入 blocked，保留 pending 供解决后重试。
        this.state = "blocked";
        this.pending = { input, baseVersion };
        this.onBlocked?.(err);
      })
      .finally(() => {
        this.inFlight = null;
        if (this.state === "blocked") return;
        this.state = "idle";
        // 在途期间又来新输入：立即再保存一次。
        if (this.pending) this.pump();
      });
  }

  /** 立即保存所有 pending 并等待在途完成；blocked 时抛出。 */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.inFlight) await this.inFlight.catch(() => {});
    // 循环保存 pending 直到空（在途期间新到的输入也会被保存）。
    while (this.pending && this.state !== "blocked") {
      const { input, baseVersion } = this.pending;
      this.pending = null;
      this.state = "saving";
      try {
        await this.save(input, baseVersion);
      } catch (err) {
        this.state = "blocked";
        this.pending = { input, baseVersion };
        this.onBlocked?.(err);
        throw err;
      } finally {
        this.inFlight = null;
      }
      this.state = "idle";
    }
    if (this.state === "blocked") throw new Error("save blocked by conflict");
  }

  /** 用户解决冲突后调用，恢复可保存。 */
  resolveConflict(): void {
    this.state = "idle";
    this.pending = null;
  }

  /** 销毁：清理计时器。 */
  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }
}
