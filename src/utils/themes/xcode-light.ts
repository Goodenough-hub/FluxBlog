import type { ThemeRegistrationRaw } from "shiki";

// Xcode Default (Light) 配色移植。scope 覆盖注释/关键字/字符串/数字/类型/函数/属性。
export const xcodeLight: ThemeRegistrationRaw = {
  name: "xcode-light",
  type: "light",
  colors: {
    "editor.background": "#FFFFFF",
    "editor.foreground": "#1F1F24",
  },
  settings: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#5D6C79" } },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.control", "keyword.operator.new"],
      settings: { foreground: "#AD3DA4" },
    },
    { scope: ["string", "string.quoted", "constant.other.symbol"], settings: { foreground: "#D12F1B" } },
    { scope: ["constant.numeric", "constant.language", "constant.character"], settings: { foreground: "#272AD8" } },
    { scope: ["entity.name.function", "support.function", "meta.function-call"], settings: { foreground: "#326D74" } },
    {
      scope: ["entity.name.type", "entity.name.class", "support.type", "support.class", "entity.other.inherited-class"],
      settings: { foreground: "#3900A0" },
    },
    { scope: ["variable", "variable.parameter", "variable.other"], settings: { foreground: "#1F1F24" } },
    { scope: ["entity.name.tag"], settings: { foreground: "#AD3DA4" } },
    { scope: ["entity.other.attribute-name"], settings: { foreground: "#78492A" } },
    { scope: ["meta.preprocessor", "keyword.control.directive"], settings: { foreground: "#78492A" } },
  ],
};
