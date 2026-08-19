import { useCallback, useEffect, useRef } from "react";
import {
  countSourceLines,
  normalizeAnchors,
  readSourcePosition,
  scrollTopForSourcePosition,
  sourceLineAtOffset,
  type ScrollAnchor,
  type SourcePosition,
} from "../lib/scroll-position";
import { isScrollNavigationKey } from "../lib/scroll-intent";

interface ScrollSyncOptions {
  markdown: string;
  scopeKey: number | string;
}

type Side = "editor" | "preview";

function contentTop(root: HTMLElement, element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  if (root.ownerDocument.scrollingElement === root) {
    return rect.top + root.scrollTop;
  }
  return rect.top - root.getBoundingClientRect().top + root.scrollTop;
}

function isHTMLElement(
  element: Element,
  document: Document
): element is HTMLElement {
  const ElementClass = document.defaultView?.HTMLElement;
  return Boolean(ElementClass && element instanceof ElementClass);
}

function editorAnchors(root: HTMLElement, markdown: string): ScrollAnchor[] {
  const totalLines = countSourceLines(markdown);
  const anchors: ScrollAnchor[] = [
    { sourceLine: 1, top: 0 },
    { sourceLine: totalLines, top: root.scrollHeight },
  ];
  let cursor = 0;

  for (const child of Array.from(root.children)) {
    if (!isHTMLElement(child, root.ownerDocument)) continue;
    if (child.dataset.block !== "0") continue;

    const text = (child.textContent ?? "").replace(/[\u200b\u2060]/g, "");
    let offset = text ? markdown.indexOf(text, cursor) : cursor;
    if (offset < 0 && text.trim()) {
      offset = markdown.indexOf(text.trim(), cursor);
    }
    if (offset < 0) offset = cursor;

    anchors.push({
      sourceLine: sourceLineAtOffset(markdown, offset),
      top: contentTop(root, child),
    });
    cursor = Math.max(cursor, offset + text.length);
  }

  return normalizeAnchors(anchors);
}

function previewAnchors(root: HTMLElement, markdown: string): ScrollAnchor[] {
  const article = root.ownerDocument.getElementById("article");
  if (!article) return [];

  const totalLines = countSourceLines(markdown);
  const anchors: ScrollAnchor[] = [
    { sourceLine: 1, top: contentTop(root, article) },
    {
      sourceLine: totalLines,
      top: contentTop(root, article) + article.getBoundingClientRect().height,
    },
  ];

  for (const child of Array.from(article.children)) {
    if (!isHTMLElement(child, root.ownerDocument)) continue;
    const sourceStart = Number(child.dataset.sourceStart);
    if (!Number.isFinite(sourceStart)) continue;
    anchors.push({
      sourceLine: sourceStart,
      top: contentTop(root, child),
    });
  }

  return normalizeAnchors(anchors);
}

export function useScrollSync(
  editor: HTMLElement | null,
  preview: HTMLElement | null,
  { markdown, scopeKey }: ScrollSyncOptions
) {
  const editorRef = useRef(editor);
  const previewRef = useRef(preview);
  const markdownRef = useRef(markdown);
  const positionRef = useRef<SourcePosition | null>(null);
  const programmaticRef = useRef<{
    side: Side;
    top: number;
    expiresAt: number;
  } | null>(null);
  const userIntentRef = useRef<{
    side: Side;
    expiresAt: number;
  } | null>(null);

  editorRef.current = editor;
  previewRef.current = preview;
  markdownRef.current = markdown;

  const getAnchors = useCallback((side: Side, root: HTMLElement) => {
    return side === "editor"
      ? editorAnchors(root, markdownRef.current)
      : previewAnchors(root, markdownRef.current);
  }, []);

  const readPosition = useCallback(
    (side: Side, root: HTMLElement): SourcePosition | null => {
      const anchors = getAnchors(side, root);
      if (!anchors.length) return null;
      return readSourcePosition(
        anchors,
        root.scrollTop,
        root.clientHeight,
        root.scrollHeight
      );
    },
    [getAnchors]
  );

  const writePosition = useCallback(
    (side: Side, root: HTMLElement, position: SourcePosition) => {
      const anchors = getAnchors(side, root);
      if (!anchors.length) return;
      const top = scrollTopForSourcePosition(
        anchors,
        position,
        root.clientHeight,
        root.scrollHeight
      );
      if (Math.abs(root.scrollTop - top) < 1) return;
      programmaticRef.current = {
        side,
        top,
        expiresAt: performance.now() + 160,
      };
      root.scrollTop = top;
    },
    [getAnchors]
  );

  const captureEditorPosition = useCallback(() => {
    const root = editorRef.current;
    if (!root) return;
    const position = readPosition("editor", root);
    if (position) positionRef.current = position;
  }, [readPosition]);

  const restorePreviewPosition = useCallback(
    (root: HTMLElement | null) => {
      if (root && positionRef.current) {
        writePosition("preview", root, positionRef.current);
      }
    },
    [writePosition]
  );

  useEffect(() => {
    positionRef.current = null;
    programmaticRef.current = null;
    userIntentRef.current = null;
  }, [scopeKey]);

  useEffect(() => {
    if (!editor || !preview) return;
    let frame = 0;
    const interactionCleanups: Array<() => void> = [];

    const markUserIntent = (side: Side, duration = 350) => {
      programmaticRef.current = null;
      userIntentRef.current = {
        side,
        expiresAt: performance.now() + duration,
      };
    };

    const addInteractionListeners = (side: Side, element: HTMLElement) => {
      const onWheel = () => markUserIntent(side);
      const onTouchStart = () => markUserIntent(side, 700);
      const onKeyDown = (event: KeyboardEvent) => {
        if (isScrollNavigationKey(event.key)) markUserIntent(side);
      };
      const onPointerDown = (event: PointerEvent) => {
        const rect = element.getBoundingClientRect();
        if (
          element.scrollHeight > element.clientHeight &&
          event.clientX >= rect.right - 20
        ) {
          markUserIntent(side, 60_000);
        }
      };
      const onPointerUp = () => {
        const intent = userIntentRef.current;
        if (intent?.side === side) intent.expiresAt = performance.now() + 150;
      };

      element.addEventListener("wheel", onWheel, { passive: true });
      element.addEventListener("touchstart", onTouchStart, { passive: true });
      element.addEventListener("keydown", onKeyDown);
      element.addEventListener("pointerdown", onPointerDown, { passive: true });
      element.ownerDocument.defaultView?.addEventListener(
        "pointerup",
        onPointerUp,
        { passive: true }
      );
      interactionCleanups.push(() => {
        element.removeEventListener("wheel", onWheel);
        element.removeEventListener("touchstart", onTouchStart);
        element.removeEventListener("keydown", onKeyDown);
        element.removeEventListener("pointerdown", onPointerDown);
        element.ownerDocument.defaultView?.removeEventListener(
          "pointerup",
          onPointerUp
        );
      });
    };

    const sync = (side: Side, source: HTMLElement, target: HTMLElement) => {
      const pending = programmaticRef.current;
      if (
        pending?.side === side &&
        performance.now() <= pending.expiresAt &&
        Math.abs(source.scrollTop - pending.top) < 2
      ) {
        return;
      }

      const intent = userIntentRef.current;
      const now = performance.now();
      if (!intent || intent.side !== side || now > intent.expiresAt) return;
      intent.expiresAt = now + 180;

      const position = readPosition(side, source);
      if (!position) return;
      positionRef.current = position;
      writePosition(
        side === "editor" ? "preview" : "editor",
        target,
        position
      );
    };

    const queueSync = (side: Side, source: HTMLElement, target: HTMLElement) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => sync(side, source, target));
    };
    const onEditorScroll = () => queueSync("editor", editor, preview);
    const onPreviewScroll = () => queueSync("preview", preview, editor);

    addInteractionListeners("editor", editor);
    addInteractionListeners("preview", preview);
    editor.addEventListener("scroll", onEditorScroll, { passive: true });
    preview.addEventListener("scroll", onPreviewScroll, { passive: true });

    const restore = () => {
      restorePreviewPosition(preview);
    };
    requestAnimationFrame(() => requestAnimationFrame(restore));
    const settleTimers = [250, 800].map(delay => window.setTimeout(restore, delay));
    const article = preview.ownerDocument.getElementById("article");
    const resizeObserver = article ? new ResizeObserver(restore) : null;
    if (article && resizeObserver) resizeObserver.observe(article);
    const stopObserver = window.setTimeout(() => resizeObserver?.disconnect(), 1500);

    return () => {
      cancelAnimationFrame(frame);
      editor.removeEventListener("scroll", onEditorScroll);
      preview.removeEventListener("scroll", onPreviewScroll);
      for (const cleanup of interactionCleanups) cleanup();
      for (const timer of settleTimers) window.clearTimeout(timer);
      window.clearTimeout(stopObserver);
      resizeObserver?.disconnect();
    };
  }, [editor, preview, readPosition, restorePreviewPosition, writePosition]);

  return { captureEditorPosition, restorePreviewPosition };
}
