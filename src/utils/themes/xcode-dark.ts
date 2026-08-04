import type { ThemeRegistrationRaw } from "shiki";

// Xcode Default (Dark) 配色移植。scope 与 light 对齐，仅换颜色值。
export const xcodeDark: ThemeRegistrationRaw = {
  name: "xcode-dark",
  type: "dark",
  colors: {
    "editor.background": "#292A30",
    "editor.foreground": "#DFDFE0",
  },
  settings: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#7F8C98" } },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.control", "keyword.operator.new"],
      settings: { foreground: "#FF7AB2" },
    },
    { scope: ["string", "string.quoted", "constant.other.symbol"], settings: { foreground: "#FF8170" } },
    { scope: ["constant.numeric", "constant.language", "constant.character"], settings: { foreground: "#D9C97C" } },
    { scope: ["entity.name.function", "support.function", "meta.function-call"], settings: { foreground: "#67B7A4" } },
    {
      scope: ["entity.name.type", "entity.name.class", "support.type", "support.class", "entity.other.inherited-class"],
      settings: { foreground: "#DABAFF" },
    },
    { scope: ["variable", "variable.parameter", "variable.other"], settings: { foreground: "#DFDFE0" } },
    { scope: ["entity.name.tag"], settings: { foreground: "#FF7AB2" } },
    { scope: ["entity.other.attribute-name"], settings: { foreground: "#FFA14F" } },
    { scope: ["meta.preprocessor", "keyword.control.directive"], settings: { foreground: "#FFA14F" } },
  ],
};
