import { useEffect, useState } from "react";
import { ConfigProvider, theme as antdTheme } from "antd";
import zhCN from "antd/locale/zh_CN";

interface ThemeState {
  isDark: boolean;
}

// 通过 MutationObserver 监听 html[data-theme] 变化（FluxBlog 前台 theme.ts 设置）
// 切换时重渲染 ConfigProvider，让 Antd algorithm 跟随。
function useHtmlTheme(): ThemeState {
  const [isDark, setIsDark] = useState<boolean>(
    document.documentElement.dataset.theme === "dark" ||
      document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const dark =
        document.documentElement.dataset.theme === "dark" ||
        document.documentElement.classList.contains("dark");
      setIsDark(dark);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  return { isDark };
}

interface Props {
  children: React.ReactNode;
}

export default function ThemeProvider({ children }: Props) {
  const { isDark } = useHtmlTheme();

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#6366f1",
          borderRadius: 10,
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        },
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      {children}
    </ConfigProvider>
  );
}
