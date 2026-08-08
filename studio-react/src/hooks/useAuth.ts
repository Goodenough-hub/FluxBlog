import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isLoggedIn, login, logout } from "../api/client";

// 鉴权 hook：未登录时跳 /login。提供 doLogin / doLogout。
export function useAuth() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setReady(true);
  }, []);

  return {
    ready,
    loggedIn,
    async doLogin(username: string, password: string) {
      const ok = await login(username, password);
      if (ok) {
        setLoggedIn(true);
        navigate("/");
      }
      return ok;
    },
    async doLogout() {
      await logout();
      setLoggedIn(false);
      navigate("/login");
    },
  };
}
