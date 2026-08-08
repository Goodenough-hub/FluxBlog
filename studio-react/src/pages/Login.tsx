import { useEffect } from "react";
import { Card, Form, Input, Button, App as AntdApp } from "antd";
import { useAuth } from "../hooks/useAuth";

// Phase 2 占位：登录页骨架。Phase 4 会按 ThriveX 视觉精修。
export default function LoginPage() {
  const { doLogin, loggedIn } = useAuth();
  const { message } = AntdApp.useApp();

  useEffect(() => {
    if (loggedIn) {
      window.location.hash = "#/";
    }
  }, [loggedIn]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card
        title="FluxBlog Studio"
        className="w-full max-w-sm"
        styles={{ body: { padding: 24 } }}
      >
        <Form
          layout="vertical"
          onFinish={async (v) => {
            const ok = await doLogin(v.username, v.password);
            if (!ok) {
              message.error("用户名或密码错误");
            }
          }}
        >
          <Form.Item label="用户名" name="username" rules={[{ required: true }]}>
            <Input autoFocus placeholder="用户名" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true }]}>
            <Input.Password placeholder="密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form>
        <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
          独立博客账号，与 FinFlow/AppPilot 账号隔离
        </p>
      </Card>
    </div>
  );
}
