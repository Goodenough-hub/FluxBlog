import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import Vditor from "vditor";
import {
  prepareImage,
  uploadImage,
  isAcceptedImage,
} from "../lib/image-utils";

export interface VditorEditorHandle {
  // 取 Vditor 内部滚动元素（.vditor-sv），供 useScrollSync 用
  getScrollEl: () => HTMLElement | null;
}

export interface VditorEditorProps {
  value: string;
  draftId: number;
  onChange: (markdown: string) => void;
}

// React 包装 Vditor：
// - mode='sv'（split-view 源码模式）：代码块直接显示 ```python … ```
//   原文，不渲染富文本，避免 ir/wysiwyg 下代码块双 pre 重复
// - 关闭内置 preview（左预览由 PreviewFrame 走 FluxBlog 发布态渲染管线）
// - upload.handler 接 image-utils 的 WebP/EXIF 预处理 + cookie 上传
// - theme 跟随 html[data-theme]（与 Antd 一致，由 MutationObserver 同步）
const VditorEditor = forwardRef<VditorEditorHandle, VditorEditorProps>(
  function VditorEditor({ value, draftId, onChange }, ref) {
    const rootRef = useRef<HTMLDivElement>(null);
    const vditorRef = useRef<Vditor | null>(null);

    useImperativeHandle(ref, () => ({
      getScrollEl: () => {
        const el = rootRef.current?.querySelector<HTMLElement>(".vditor-sv");
        return el ?? null;
      },
    }));
  // onChange 通过 ref 透传，避免每次重渲染都重建 Vditor
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const draftIdRef = useRef(draftId);
  draftIdRef.current = draftId;
  const readyRef = useRef(false);
  const pendingChangeRef = useRef<((md: string) => void) | null>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const root = rootRef.current;

    const initialDark =
      document.documentElement.dataset.theme === "dark" ||
      document.documentElement.classList.contains("dark");

    const vditor = new Vditor(root, {
      mode: "sv",
      value,
      height: "100%",
      width: "100%",
      toolbar: [
        "emoji", "headings", "bold", "italic", "strike", "|",
        "line", "quote", "list", "ordered-list", "check", "outdent", "indent", "|",
        "code", "inline-code", "insert-before", "insert-after", "link", "table", "|",
        "upload", "record", "preview", "outline", "|",
        "undo", "redo", "edit-mode",
      ],
      toolbarConfig: { pin: true },
      upload: {
        accept: "image/*",
        multiple: true,
        // Vditor 约定：handler 返回非空字符串会被当作错误信息弹窗显示。
        // 故上传成功后直接用 vditor.insertValue 插入 Markdown，返回 null。
        handler: (files: File[]) => {
          return (async () => {
            const valid = files.filter(isAcceptedImage);
            if (!valid.length) return null;
            const markdowns: string[] = [];
            for (const f of valid) {
              try {
                const prepared = await prepareImage(f);
                const url = await uploadImage(prepared, draftIdRef.current);
                const alt = f.name.replace(/\.[^.]+$/, "");
                // 插入 <img> 标签：带原始像素尺寸，max-width:100% 防止溢出文章容器。
                markdowns.push(
                  `<img src="${url}" alt="${alt}" width="${prepared.width}" height="${prepared.height}" style="max-width:100%;height:auto;" />`
                );
              } catch (e) {
                console.error("vditor upload failed", e);
                return e instanceof Error ? e.message : "图片上传失败";
              }
            }
            if (markdowns.length) {
              vditor.insertValue(markdowns.join("\n"));
            }
            return null;
          })() as Promise<string>;
        },
      },
      preview: {
        delay: 0,
        mode: "editor",
        hljs: { enable: false },
        markdown: { toc: false },
      },
      cache: { enable: false },
      counter: { enable: true, type: "markdown" },
      comment: { enable: false },
      input: (v: string) => {
        if (!readyRef.current) {
          pendingChangeRef.current = onChangeRef.current;
          return;
        }
        onChangeRef.current(v);
      },
      after: () => {
        readyRef.current = true;
        if (pendingChangeRef.current) {
          const fn = pendingChangeRef.current;
          pendingChangeRef.current = null;
          fn(vditor.getValue());
        }
      },
      theme: initialDark ? "dark" : "classic",
    });
    vditorRef.current = vditor;

    // 主题跟随
    const observer = new MutationObserver(() => {
      const dark =
        document.documentElement.dataset.theme === "dark" ||
        document.documentElement.classList.contains("dark");
      try {
        vditor.setTheme(dark ? "dark" : "classic");
      } catch {
        /* ignore */
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    return () => {
      observer.disconnect();
      readyRef.current = false;
      pendingChangeRef.current = null;
      try {
        vditor.destroy();
      } catch {
        /* ignore */
      }
      vditorRef.current = null;
    };
    // 故意只在 mount 时创建。value 变化通过 setValue 在下面处理。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部 value 变化（如切换草稿、恢复版本）时同步到 Vditor。
  // 比较内容避免回环：onChange 后内部已同步，外部 value 与内部一致时不重置。
  useEffect(() => {
    const vd = vditorRef.current;
    if (!vd || !readyRef.current) return;
    const current = vd.getValue();
    if (current !== value) {
      vd.setValue(value);
    }
  }, [value]);

    return <div ref={rootRef} className="st-vditor-host h-full w-full" />;
  }
);

export default VditorEditor;
