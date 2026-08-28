/**
 * 编辑器顶栏发布按钮三态。纯函数，便于测试。
 * - 草稿 → "publish"（[发布]，开 PublishModal）
 * - 已发布 + 有未发布修改 → "republish"（[更新发布] + [撤回]）
 * - 已发布 + 无未发布修改 → "published-clean"（仅 [撤回]）
 *
 * 未发布修改有两个来源，任一成立即视为有修改：
 * - hasUnpublishedChanges：服务端派生（version > publishedVersion），
 *   需等自动保存往返后才为 true；
 * - dirty：useSaveController 的本地未保存修改（排队中/保存中/冲突/失败），
 *   编辑发生的当次渲染即为 true，让"更新发布"按钮立即出现。
 */
export function editorPublishState(input: {
  status: string;
  hasUnpublishedChanges?: boolean;
  dirty: boolean;
}): "publish" | "republish" | "published-clean" {
  if (input.status !== "published") return "publish";
  return input.hasUnpublishedChanges === true || input.dirty
    ? "republish"
    : "published-clean";
}
