#!/bin/bash
#
# 使用 PyInstaller 将 Python 后端打包为独立可执行文件
# 输出: backend-dist/ecomind-backend (macOS/Linux) 或 ecomind-backend.exe (Windows)
#
# 前置条件: pip install pyinstaller
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
BACKEND_DIR="$ROOT_DIR/backend"
OUTPUT_DIR="$ROOT_DIR/backend-dist"

echo "=== EcoMind OS 后端打包 ==="
echo "源目录: $BACKEND_DIR"
echo "输出目录: $OUTPUT_DIR"
echo ""

# 检查 PyInstaller
if ! python3 -c "import PyInstaller" 2>/dev/null; then
    echo "[!] PyInstaller 未安装，正在安装..."
    pip3 install pyinstaller
fi

# 创建临时打包入口
ENTRY_FILE="$BACKEND_DIR/__main__.py"
cat > "$ENTRY_FILE" << 'PYEOF'
"""PyInstaller 打包入口 — EcoMind OS Backend"""
import uvicorn
import sys
import os

def main():
    port = 8000
    for i, arg in enumerate(sys.argv):
        if arg == "--port" and i + 1 < len(sys.argv):
            port = int(sys.argv[i + 1])

    # 静态文件路径: PyInstaller 打包后从资源目录读取
    if getattr(sys, 'frozen', False):
        os.chdir(os.path.dirname(sys.executable))

    uvicorn.run(
        "api.main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )

if __name__ == "__main__":
    main()
PYEOF

# 清理旧输出
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# PyInstaller 打包
echo "[1/3] PyInstaller 打包中..."
cd "$BACKEND_DIR"

python3 -m PyInstaller \
    --onefile \
    --name "ecomind-backend" \
    --distpath "$OUTPUT_DIR" \
    --workpath "$OUTPUT_DIR/.build" \
    --specpath "$OUTPUT_DIR" \
    --add-data "api:api" \
    --add-data "engine:engine" \
    --add-data "govmcp:govmcp" \
    --add-data "inference:inference" \
    --add-data "memory:memory" \
    --add-data "safety:safety" \
    --add-data "skills:skills" \
    --add-data "nats:nats" \
    --add-data "graph:graph" \
    --hidden-import "uvicorn.logging" \
    --hidden-import "uvicorn.loops.auto" \
    --hidden-import "uvicorn.protocols.http.auto" \
    --hidden-import "fastapi" \
    --hidden-import "pydantic" \
    --hidden-import "httpx" \
    --hidden-import "aiohttp" \
    --hidden-import "websockets" \
    --collect-all "api" \
    "$ENTRY_FILE"

# 清理临时入口
rm -f "$ENTRY_FILE"

# 验证输出
if [ -f "$OUTPUT_DIR/ecomind-backend" ]; then
    echo ""
    echo "✅ 打包成功!"
    echo "   二进制文件: $OUTPUT_DIR/ecomind-backend"
    ls -lh "$OUTPUT_DIR/ecomind-backend"
elif [ -f "$OUTPUT_DIR/ecomind-backend.exe" ]; then
    echo ""
    echo "✅ 打包成功!"
    echo "   二进制文件: $OUTPUT_DIR/ecomind-backend.exe"
    ls -lh "$OUTPUT_DIR/ecomind-backend.exe"
else
    echo ""
    echo "❌ 打包失败: 未找到输出文件"
    exit 1
fi

echo ""
echo "=== 后端打包完成 ==="
