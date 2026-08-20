import { describe, expect, it } from "vitest";
import { validateRename } from "./taxonomy";

describe("validateRename", () => {
  it("清理名称两端空格并允许使用新名称", () => {
    expect(validateRename("旧名称", "  新名称  ", ["旧名称"])).toEqual({
      name: "新名称",
      error: null,
    });
  });

  it("拒绝空名称、原名称和已存在名称", () => {
    expect(validateRename("旧名称", "  ", ["旧名称"]).error).toBe("名称不能为空");
    expect(validateRename("旧名称", "旧名称", ["旧名称"]).error).toBe(
      "新名称不能与原名称相同"
    );
    expect(validateRename("旧名称", "已有名称", ["旧名称", "已有名称"]).error).toBe(
      "名称已存在"
    );
  });
});
