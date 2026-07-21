#!/bin/bash
# 前端一键部署（在阿里云服务器上运行）：
#   构建 frontend/dist，并同步到 nginx 网站目录。
# 用法：
#   cd /www/server/su-yunshi-log && git pull
#   bash scripts/deploy-frontend.sh
set -e

cd "$(dirname "$0")/../frontend"

echo "==> 构建前端..."
npm run build

TARGET="/www/wwwroot/lumiclaw.top/sylog"

echo "==> 同步到 $TARGET ..."
if command -v rsync >/dev/null 2>&1; then
  # --delete：目标目录里已被构建移除的旧文件一并清理，避免残留旧 hash 资源
  rsync -a --delete dist/ "$TARGET/"
else
  # 无 rsync 时的兜底：先清后拷（目录固定，安全）
  rm -rf "${TARGET:?}/"*
  cp -r dist/* "$TARGET/"
fi

echo "==> 前端部署完成，刷新页面即可看到新版"
