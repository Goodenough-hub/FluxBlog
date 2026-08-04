/**
 * 共享 markdown 插件配置：astro.config.ts（构建期）、renderMarkdown.ts（SSR）、
 * preview.ts（Studio 客户端）都引用，避免多套渲染分叉。
 *
 * Shiki 双主题：Xcode 浅色 / 深色，defaultColor:false（由 CSS 变量
 * --shiki-light-bg / --shiki-dark-bg 按 data-theme 切换）。代码块外观由
 * transformerCodeWindow 包成 macOS 窗口，文件名折叠进标题栏。
 */
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerCodeWindow } from "./transformers/codeWindow.js";
import { xcodeLight } from "./themes/xcode-light";
import { xcodeDark } from "./themes/xcode-dark";

export const shikiThemes = {
  light: xcodeLight,
  dark: xcodeDark,
} as const;

export const shikiTransformers = [
  transformerCodeWindow(),
  transformerNotationHighlight(),
  transformerNotationWordHighlight(),
  transformerNotationDiff({ matchAlgorithm: "v3" }),
];
