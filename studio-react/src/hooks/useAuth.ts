import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isLoggedIn, login, logout, fetchMe, type MeResponse } from "../api/client";

// 鉴权 hook：未登录跳 /login。提供 doLogin / doLogout。
// 同时拉取 /auth/me 判断 isAdmin——Studio 是 admin 专区，非 admin
// 用户即使登录也不让进（后端 /drafts* 会 403，前端先一步挡掉并提示）。
export function useAuth() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const logged = isLoggedIn();
    setLoggedIn(logged);
    if (!logged) {
      setReady(true);
      return;
    }
    fetchMe()
      .then((res) => setMe(res))
      .catch(() => {
        // /me 失败视作未登录（token 失效等）
        setLoggedIn(false);
      })
      .finally(() => setReady(true));
  }, []);

  return {
    ready,
    loggedIn,
    me,
    isAdmin: me?.isAdmin === true,
    async doLogin(username: string, password: string) {
      const ok = await login(username, password);
      if (ok) {
        setLoggedIn(true);
        try {
          const res = await fetchMe();
          setMe(res);
        } catch {
          /* ignore */
        }
        navigate("/");
      }
      return ok;
    },
    async doLogout() {
      await logout();
      setLoggedIn(false);
      setMe(null);
      navigate("/login");
    },
  };
}
