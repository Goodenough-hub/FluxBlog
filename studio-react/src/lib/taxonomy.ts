export interface RenameValidation {
  name: string;
  error: string | null;
}

export interface TagOption {
  value: string;
  label: string;
}

// 合并「全局已有标签」与「当前草稿标签」，去重后转成 Select 候选项。
// 顺序：全局标签在前，草稿独有的标签追加在后——保证当前草稿的标签即使尚未
// 出现在全局标签列表（如刚输入未保存）也始终可见、可回选。
export function buildTagOptions(
  allTags: string[],
  currentTags: string[]
): TagOption[] {
  return Array.from(new Set([...allTags, ...currentTags])).map((t) => ({
    value: t,
    label: t,
  }));
}

export function validateRename(
  currentName: string,
  input: string,
  existingNames: string[]
): RenameValidation {
  const name = input.trim();
  if (!name) return { name, error: "名称不能为空" };
  if (name === currentName) return { name, error: "新名称不能与原名称相同" };
  if (existingNames.some((existing) => existing !== currentName && existing === name)) {
    return { name, error: "名称已存在" };
  }
  return { name, error: null };
}
