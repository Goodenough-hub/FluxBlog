#!/bin/bash
# FluxBlog 部署脚本 — 续跑版（import-blog 已手工完成，跳过）
# 在服务器上执行：bash /tmp/fluxblog-deploy/deploy.sh
set -euo pipefail

BUNDLE=/tmp/fluxblog-deploy
TS=$(date +%Y%m%d-%H%M%S)
APPPLOT_DIR=/opt/apppilot
FLUXBLOG_OPT=/opt/fluxblog
FLUXBLOG_WWW=/var/www/fluxblog
SITE_URL="${FLUXBLOG_SITE_URL:-http://121.40.145.100}"

log(){ echo ">>> $*"; }

# --- 0. node ---
NODE_BIN="$(command -v node || true)"
[ -n "$NODE_BIN" ] || { echo "!!! node 未安装"; exit 1; }
log "node: $NODE_BIN ($(node -v))"

# --- 0b. env ---
set +eu
eval "$(systemctl show apppilot -p Environment --value)"
set -eu
: "${APPLOT_BLOG_ASSET_DIR:=/var/lib/apppilot/fluxblog}"
export APPLOT_DSN APPLOT_BLOG_JWT_SECRET APPLOT_BLOG_ASSET_DIR APPLOT_ADDRESS APPLOT_JWT_SECRET
log "DSN长度=${#APPPLOT_DSN} JWT长度=${#APPPLOT_JWT_SECRET}"
[ -n "${APPPLOT_DSN:-}" ] || { echo "!!! 无法解析 APPLOT_DSN"; exit 1; }

# --- 1. DB 备份 ---
mkdir -p "$APPPLOT_DIR/backups"
DBBACKUP="$APPPLOT_DIR/backups/finflow-$TS.sql"
log "DB 备份 -> $DBBACKUP"
pg_dump "$APPPLOT_DSN" > "$DBBACKUP"
ls -la "$DBBACKUP"

# --- 2. 二进制 ---
log "替换 apppilot 二进制"
install -m755 -o root -g root "$BUNDLE/apppilot-server" "$APPPLOT_DIR/apppilot-server.new"
mv "$APPPLOT_DIR/apppilot-server" "$APPPLOT_DIR/apppilot-server.bak.$TS"
mv "$APPPLOT_DIR/apppilot-server.new" "$APPPLOT_DIR/apppilot-server"
systemctl restart apppilot
log "等待 apppilot 健康"
for i in $(seq 1 20); do
  if curl -sf http://127.0.0.1:8080/api/v1/blog/posts >/dev/null 2>&1; then log "apppilot up"; break; fi
  sleep 1
done
curl -sf http://127.0.0.1:8080/api/v1/blog/posts >/dev/null || {
  echo "!!! apppilot 未健康；回滚二进制"
  mv "$APPPLOT_DIR/apppilot-server.bak.$TS" "$APPPLOT_DIR/apppilot-server"
  systemctl restart apppilot
  exit 1
}
journalctl -u apppilot --since "1 min ago" --no-pager | tail -20

# --- 3. 内容校验（import-blog 已手工完成） ---
BLOG_USER="$(psql "$APPPLOT_DSN" -tAc "SELECT username FROM blog_users WHERE deleted_at IS NULL AND is_enabled ORDER BY id LIMIT 1" 2>/dev/null || true)"
log "blog 用户: $BLOG_USER"
psql "$APPPLOT_DSN" -c "SELECT id, slug, status, visibility FROM blog_drafts ORDER BY id;"
PUB_COUNT="$(psql "$APPPLOT_DSN" -tAc "SELECT count(*) FROM blog_drafts WHERE status='published' AND visibility='public'")"
log "公开已发布: $PUB_COUNT"
[ "$PUB_COUNT" -ge 2 ] || { echo "!!! 公开文档 < 2"; exit 1; }

# --- 4. fluxblog.service + dist ---
log "部署 fluxblog dist"
useradd -r -s /usr/sbin/nologin fluxblog 2>/dev/null || true
mkdir -p "$FLUXBLOG_OPT" "$FLUXBLOG_WWW"
rm -rf "$FLUXBLOG_OPT/server" "$FLUXBLOG_WWW/client"
tar -C "$FLUXBLOG_OPT" -xzf "$BUNDLE/fluxblog-server.tar.gz"
tar -C "$FLUXBLOG_WWW" -xzf "$BUNDLE/fluxblog-client.tar.gz"
chown -R fluxblog:fluxblog "$FLUXBLOG_OPT"
sed -e "s#/usr/bin/node#$NODE_BIN#" -e "s#FLUXBLOG_SITE_URL=.*#FLUXBLOG_SITE_URL=$SITE_URL#" \
  "$BUNDLE/fluxblog.service" > /etc/systemd/system/fluxblog.service
systemctl daemon-reload
systemctl enable --now fluxblog
log "等待 fluxblog 健康"
for i in $(seq 1 15); do
  if curl -sf http://127.0.0.1:4321/blog/login/ >/dev/null 2>&1; then log "fluxblog up"; break; fi
  sleep 1
done
curl -sf http://127.0.0.1:4321/blog/login/ >/dev/null || { echo "!!! fluxblog 未健康"; journalctl -u fluxblog --no-pager | tail -30; exit 1; }
curl -s -o /dev/null -w "SSR /blog/ -> HTTP %{http_code}\n" http://127.0.0.1:4321/blog/

# --- 5. nginx ---
log "nginx /blog/ 切换"
cp /etc/nginx/conf.d/finflow.conf "/etc/nginx/conf.d/finflow.conf.bak.$TS"
python3 - <<PY
p = "/etc/nginx/conf.d/finflow.conf"
s = open(p).read()
old = """location = /blog {
    return 301 /blog/;
}
location ^~ /blog/ {
    alias /var/www/fluxblog/;
    try_files \$uri \$uri/ =404;
    location ~* /blog/(_astro|pagefind)/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}"""
new = """location = /blog { return 301 /blog/; }
location /blog/ {
    proxy_pass http://127.0.0.1:4321;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}
location /blog/_astro/ {
    alias /var/www/fluxblog/client/_astro/;
    expires 1y;
    add_header Cache-Control "public, immutable";
}"""
assert old in s, "旧 /blog 块未逐字命中 — 不改动（中止）"
open(p, "w").write(s.replace(old, new, 1))
print("nginx /blog 块已替换")
PY
nginx -t || { echo "!!! nginx -t 失败，恢复备份"; cp "/etc/nginx/conf.d/finflow.conf.bak.$TS" /etc/nginx/conf.d/finflow.conf; exit 1; }
systemctl reload nginx

# --- 6. 验证 ---
log "线上验证"
curl -s -o /dev/null -w "/blog/ -> HTTP %{http_code}\n" http://127.0.0.1/blog/
curl -s -o /dev/null -w "/api/v1/blog/posts -> HTTP %{http_code}\n" http://127.0.0.1/api/v1/blog/posts
curl -s http://127.0.0.1/api/v1/blog/posts | head -c 200; echo

echo ""
echo "================ DEPLOY OK ================"
echo "DB 备份: $DBBACKUP"
echo "nginx 备份: /etc/nginx/conf.d/finflow.conf.bak.$TS"
echo "旧二进制: $APPPLOT_DIR/apppilot-server.bak.$TS"
echo ""
echo "回滚命令:"
echo "  cp /etc/nginx/conf.d/finflow.conf.bak.$TS /etc/nginx/conf.d/finflow.conf && systemctl reload nginx"
echo "  systemctl disable --now fluxblog"
echo "  mv $APPPLOT_DIR/apppilot-server.bak.$TS $APPPLOT_DIR/apppilot-server && systemctl restart apppilot"
echo "  psql \"$APPPLOT_DSN\" -f $DBBACKUP"