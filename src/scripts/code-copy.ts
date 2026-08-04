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
  // 清除上一次未触发的复原计时器，避免连点时把「已复制」当作原始文案复原而卡住。
  const prevTimer = btn.dataset.copyTimer;
  if (prevTimer) window.clearTimeout(Number(prevTimer));
  try {
    await copyText(text);
    btn.textContent = "已复制";
  } catch {
    btn.textContent = "复制失败";
  }
  const id = window.setTimeout(() => {
    btn.textContent = "复制";
    delete btn.dataset.copyTimer;
  }, 1500);
  btn.dataset.copyTimer = String(id);
});
