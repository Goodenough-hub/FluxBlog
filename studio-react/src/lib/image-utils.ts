// 图片预处理：JPEG/PNG/WebP 在浏览器转 WebP（最长边 2560px、质量 0.82），
// Canvas 重编码同时移除 EXIF（createImageBitmap imageOrientation 应用方向）；
// GIF 保持原格式；SVG 拒绝。原文件 ≤25MiB，转换结果 ≤8MiB（后端上限）。
// 鉴权：httpOnly cookie 自动携带，无需手动注入 token。
export const MAX_RAW = 25 * 1024 * 1024;
const MAX_EDGE = 2560;
const QUALITY = 0.82;
const API_BASE = "/api/v1/blog";

export interface PreparedImage {
  blob: Blob;
  mime: string;
  filename: string;
}

export function isAcceptedImage(file: File): boolean {
  return /image\/(jpeg|png|webp|gif)/.test(file.type);
}

export function fitToEdge(w: number, h: number): { w: number; h: number } {
  const longest = Math.max(w, h);
  if (longest <= MAX_EDGE) return { w, h };
  const scale = MAX_EDGE / longest;
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "") || "image";
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("encode failed"))),
      type,
      quality
    );
  });
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size > MAX_RAW) throw new Error("原文件超过 25MiB");
  if (!isAcceptedImage(file))
    throw new Error("仅接受 JPEG/PNG/WebP/GIF，拒绝 SVG");
  if (file.type === "image/gif")
    return { blob: file, mime: "image/gif", filename: file.name };

  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  }).catch(() => null);
  let canvas: HTMLCanvasElement;
  if (bitmap) {
    const { w, h } = fitToEdge(bitmap.width, bitmap.height);
    canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
  } else {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImg(url);
      const { w, h } = fitToEdge(img.naturalWidth, img.naturalHeight);
      canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const blob = await canvasToBlob(canvas, "image/webp", QUALITY);
  if (blob.size > 8 * 1024 * 1024)
    throw new Error("转换后超过 8MiB，请缩小或压缩");
  return { blob, mime: "image/webp", filename: baseName(file.name) + ".webp" };
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode failed"));
    img.src = url;
  });
}

/** 上传图片到 /assets，带进度回调与一次重试。鉴权由 cookie 自动携带。 */
export async function uploadImage(
  prepared: PreparedImage,
  draftId: number,
  onProgress?: (ratio: number) => void
): Promise<string> {
  const fd = new FormData();
  fd.append("file", prepared.blob, prepared.filename);
  fd.append("draftId", String(draftId));
  const url = `${API_BASE}/assets`;

  let lastErr: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await uploadOnce(url, fd, onProgress);
      const data = JSON.parse(text);
      return data.previewUrl as string;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("上传失败");
}

function uploadOnce(
  url: string,
  fd: FormData,
  onProgress?: (r: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    // 同源 cookie 自动携带，无需手动注入 Authorization
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr.responseText)
        : reject(new Error(`上传 ${xhr.status}`));
    xhr.onerror = () => reject(new Error("网络错误"));
    xhr.send(fd);
  });
}

/** 受保护图片：fetch Blob 后 revoke 临时 URL（外部调用方负责 revoke）。 */
export async function fetchAssetBlob(path: string): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`asset ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
