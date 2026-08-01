/**
 * 共享 markdown 插件配置：astro.config.ts（构建期，about 等静态 md）与
 * renderMarkdown.ts（SSR，DB 下发的文章正文）都引用，避免两套渲染分叉。
 *
 * Shiki 双主题与 astro.config.ts 的 shikiConfig 一致：min-light / night-owl，
 * defaultColor:false（由 CSS 变量 --shiki-light-bg / --shiki-dark-bg 切换）。
 */
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./transformers/fileName";

export const shikiThemes = {
  light: "min-light",
  dark: "night-owl",
} as const;

export const shikiTransformers = [
  transformerFileName({ style: "v2", hideDot: false }),
  transformerNotationHighlight(),
  transformerNotationWordHighlight(),
  transformerNotationDiff({ matchAlgorithm: "v3" }),
];
