#!/bin/bash
# 在服务器上执行：bash /tmp/fluxblog-deploy/run-import.sh
# 从 systemd apppilot unit 解析 env 后，调 import-blog 把 2 篇 md 入库。
set -euo pipefail
eval "$(systemctl show apppilot -p Environment --value)"
export APPPLOT_DSN APPPLOT_JWT_SECRET
echo "DSN_LEN=${#APPPLOT_DSN} JWT_LEN=${#APPPLOT_JWT_SECRET}"
/opt/apppilot/apppilot-server import-blog --dir /tmp/blog-import --username editor
echo "import-blog OK"
psql "$APPPLOT_DSN" -c "SELECT id, slug, status, visibility FROM blog_drafts ORDER BY id;"