/**
 * 发布按钮文案：根据草稿状态派生。纯函数，便于测试。
 * - draft：发布
 * - published 且有未发布修改：更新发布
 * - published 且无未发布修改：已发布
 */
export function publishLabel(d: {
  status: string;
  hasUnpublishedChanges?: boolean;
}): string {
  if (d.status === "published")
    return d.hasUnpublishedChanges ? "更新发布" : "已发布";
  return "发布";
}
