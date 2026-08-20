export interface RenameValidation {
  name: string;
  error: string | null;
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
