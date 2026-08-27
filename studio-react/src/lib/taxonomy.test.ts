import { describe, expect, it } from "vitest";
import {
  appendTag,
  buildTagOptions,
  canCreateTag,
  validateCreate,
  validateRename,
} from "./taxonomy";

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

describe("buildTagOptions", () => {
  it("展示所有全局标签作为候选项", () => {
    expect(buildTagOptions(["前端", "后端", "运维"], [])).toEqual([
      { value: "前端", label: "前端" },
      { value: "后端", label: "后端" },
      { value: "运维", label: "运维" },
    ]);
  });

  it("合并全局标签与当前草稿标签并去重（全局在前）", () => {
    expect(buildTagOptions(["前端", "后端"], ["后端", "React"])).toEqual([
      { value: "前端", label: "前端" },
      { value: "后端", label: "后端" },
      { value: "React", label: "React" },
    ]);
  });

  it("草稿独有标签（尚未入全局列表）也保留在候选里", () => {
    expect(buildTagOptions([], ["未保存标签"])).toEqual([
      { value: "未保存标签", label: "未保存标签" },
    ]);
  });
});

describe("canCreateTag", () => {
  const options = [
    { value: "前端", label: "前端" },
    { value: "后端", label: "后端" },
  ];

  it("非空且不在候选项里时可新建", () => {
    expect(canCreateTag("运维", options)).toBe(true);
    expect(canCreateTag("  运维  ", options)).toBe(true);
  });

  it("空白或已存在时不可新建", () => {
    expect(canCreateTag("", options)).toBe(false);
    expect(canCreateTag("   ", options)).toBe(false);
    expect(canCreateTag("前端", options)).toBe(false);
    expect(canCreateTag("  后端  ", options)).toBe(false);
  });
});

describe("appendTag", () => {
  it("追加新标签并清理空格", () => {
    expect(appendTag(["前端"], "  后端  ")).toEqual(["前端", "后端"]);
  });

  it("空名称或重复标签时原样返回", () => {
    const current = ["前端"];
    expect(appendTag(current, "   ")).toBe(current);
    expect(appendTag(current, "前端")).toBe(current);
  });
});

describe("validateCreate", () => {
  it("清理名称两端空格并允许使用新名称", () => {
    expect(validateCreate("  新项目  ", ["旧项目"])).toEqual({
      name: "新项目",
      error: null,
    });
  });

  it("拒绝空名称与已存在名称", () => {
    expect(validateCreate("   ", ["已有"]).error).toBe("名称不能为空");
    expect(validateCreate("已有", ["已有"]).error).toBe("名称已存在");
    expect(validateCreate("  已有  ", ["已有"]).error).toBe("名称已存在");
  });

  it("大小写敏感：React 与 react 视为不同名称", () => {
    expect(validateCreate("react", ["React"]).error).toBeNull();
  });
});
