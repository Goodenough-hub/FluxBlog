// 实时预览端点：POST { markdown } → { html }
// 服务端复用 renderMarkdown（与发布态渲染同源 remark/rehype + Shiki + KaTeX + Mermaid）。
// React 子应用 fetch 这个端点，把返回 HTML 设为 iframe srcdoc，实现"所见即发布"。
// 鉴权：复用 fluxblog_token cookie（与 /private/* 同源），未登录 401 防滥用。
import { renderMarkdown } from "@/utils/renderMarkdown";

export const prerender = false;

export async function POST({ request, cookies }: any) {
  const token = cookies.get("fluxblog_token")?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "无效 JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const markdown: string = typeof body?.markdown === "string" ? body.markdown : "";
  if (markdown.length > 1024 * 1024) {
    return new Response(JSON.stringify({ error: "正文过长（>1MB）" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const html = await renderMarkdown(markdown);
    return new Response(JSON.stringify({ html }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "渲染失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, service: "fluxblog preview-render" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
