#!/bin/bash
# ============================================================
# EcoMind OS — SGLang 本地推理服务启动脚本
# ============================================================
# 用法:
#   bash start_sglang.sh [MODEL_PATH] [GPU_IDS] [PORT]
#
# 示例:
#   bash start_sglang.sh /data/models/qwen3-72b 0,1 8001
#   bash start_sglang.sh /data/models/internlm2-20b 0 8002
# ============================================================

set -euo pipefail

# ---- 默认参数 ----
MODEL_PATH="${1:-/data/models/qwen3-72b}"
GPU_IDS="${2:-0,1}"
PORT="${3:-8001}"
HOST="${4:-0.0.0.0}"

# ---- 环境变量 ----
export CUDA_VISIBLE_DEVICES="${GPU_IDS}"

# ---- 模型参数 ----
MODEL_NAME=$(basename "${MODEL_PATH}")
NUM_GPUS=$(echo "${GPU_IDS}" | tr ',' '\n' | wc -l)
TENSOR_PARALLEL="${NUM_GPUS}"

# 根据模型名推断参数
MAX_MODEL_LEN=8192
if [[ "${MODEL_NAME}" == *"72b"* ]] || [[ "${MODEL_NAME}" == *"671b"* ]]; then
    MAX_MODEL_LEN=8192
    MEM_FRACTION_STATIC=0.88
elif [[ "${MODEL_NAME}" == *"20b"* ]] || [[ "${MODEL_NAME}" == *"34b"* ]]; then
    MAX_MODEL_LEN=8192
    MEM_FRACTION_STATIC=0.85
else
    MAX_MODEL_LEN=4096
    MEM_FRACTION_STATIC=0.80
fi

echo "╔══════════════════════════════════════════════════════╗"
echo "║         EcoMind OS — SGLang 推理服务启动            ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  模型路径: ${MODEL_PATH}"
echo "║  模型名称: ${MODEL_NAME}"
echo "║  GPU 设备: ${GPU_IDS} (${NUM_GPUS} 张)"
echo "║  张量并行: ${TENSOR_PARALLEL}"
echo "║  最大长度: ${MAX_MODEL_LEN}"
echo "║  服务端口: ${PORT}"
echo "║  显存占用: ${MEM_FRACTION_STATIC}"
echo "╚══════════════════════════════════════════════════════╝"

# ---- 检查 GPU ----
if ! command -v nvidia-smi &> /dev/null; then
    echo "[ERROR] 未检测到 nvidia-smi，请确保 NVIDIA 驱动已安装"
    exit 1
fi

echo "[INFO] GPU 状态:"
nvidia-smi --query-gpu=index,name,memory.total,memory.free --format=csv

# ---- 检查模型文件 ----
if [ ! -d "${MODEL_PATH}" ]; then
    echo "[ERROR] 模型目录不存在: ${MODEL_PATH}"
    echo "[INFO] 请先下载模型到该路径，或指定正确的模型路径"
    echo "[INFO] 推荐下载命令:"
    echo "       huggingface-cli download Qwen/Qwen3-72B --local-dir ${MODEL_PATH}"
    exit 1
fi

# ---- 检查 SGLang 安装 ----
if ! python -c "import sglang" &> /dev/null; then
    echo "[ERROR] SGLang 未安装"
    echo "[INFO] 安装命令: pip install sglang[all]"
    exit 1
fi

# ---- 启动 SGLang ----
echo "[INFO] 正在启动 SGLang 服务..."

python -m sglang.launch_server \
    --model-path "${MODEL_PATH}" \
    --host "${HOST}" \
    --port "${PORT}" \
    --tp "${TENSOR_PARALLEL}" \
    --mem-fraction-static "${MEM_FRACTION_STATIC}" \
    --context-length "${MAX_MODEL_LEN}" \
    --trust-remote-code \
    --api-key "token-ecomind-sglang"

# ---- 健康检查 ----
echo "[INFO] 等待服务就绪..."
for i in $(seq 1 60); do
    if curl -s "http://localhost:${PORT}/health" > /dev/null 2>&1; then
        echo "[OK] SGLang 服务已就绪! http://localhost:${PORT}"
        echo "[INFO] 测试命令: curl http://localhost:${PORT}/v1/models"
        exit 0
    fi
    echo "等待中... ($i/60)"
    sleep 5
done

echo "[FAIL] SGLang 启动超时"
exit 1
