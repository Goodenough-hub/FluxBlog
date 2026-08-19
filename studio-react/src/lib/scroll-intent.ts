const scrollKeys = new Set([
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
  " ",
]);

export function isScrollNavigationKey(key: string): boolean {
  return scrollKeys.has(key);
}
