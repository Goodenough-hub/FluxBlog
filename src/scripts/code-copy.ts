/**
 * 代码块复制按钮：文档级事件委托（可覆盖 Studio 预览 innerHTML 重渲染后
 * 新插入的按钮）。HTTP 非安全上下文下 navigator.clipboard 不可用，回退
 * 隐藏 textarea + execCommand。行号由 CSS ::before 生成，不进 textContent，
 * 故复制得到干净代码。
 */
function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise<void>((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy") ? resolve() : reject(new Error("execCommand failed"));
    } catch (e) {
      reject(e);
    } finally {
      document.body.removeChild(ta);
    }
  });
}

document.addEventListener("click", async e => {
  const target = e.target as HTMLElement;
  const btn = target.closest<HTMLButtonElement>("[data-copy]");
  if (!btn) return;
  const pre = btn.closest(".xcode-window")?.querySelector("pre");
  const text = pre?.textContent ?? "";
  const prev = btn.textContent;
  try {
    await copyText(text);
    btn.textContent = "已复制";
  } catch {
    btn.textContent = "复制失败";
  }
  window.setTimeout(() => {
    btn.textContent = prev;
  }, 1500);
});
