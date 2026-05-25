#!/bin/bash
# ============================================================
# EcoMind OS — vLLM 本地推理服务启动脚本
# ============================================================
# 用法:
#   bash start_vllm.sh [MODEL_PATH] [GPU_IDS] [PORT]
#
# 示例:
#   bash start_vllm.sh /data/models/deepseek-671b 0,1,2,3 8000
#   bash start_vllm.sh /data/models/qwen3-72b 0,1 8001
# ============================================================

set -euo pipefail

# ---- 默认参数 ----
MODEL_PATH="${1:-/data/models/deepseek-671b}"
GPU_IDS="${2:-0,1,2,3}"
PORT="${3:-8000}"
HOST="${4:-0.0.0.0}"

# ---- 环境变量 ----
export CUDA_VISIBLE_DEVICES="${GPU_IDS}"
export VLLM_WORKER_MULTIPROC_MODE=1
export VLLM_USE_MODELSCOPE=False

# ---- 模型参数（根据模型大小自动调整） ----
# 从模型路径中推断模型名称
MODEL_NAME=$(basename "${MODEL_PATH}")

# GPU 数量
NUM_GPUS=$(echo "${GPU_IDS}" | tr ',' '\n' | wc -l)

# 根据 GPU 数量设置张量并行度
TENSOR_PARALLEL="${NUM_GPUS}"

# 根据模型名推断最大模型长度
MAX_MODEL_LEN=8192
if [[ "${MODEL_NAME}" == *"671b"* ]] || [[ "${MODEL_NAME}" == *"72b"* ]]; then
    MAX_MODEL_LEN=8192
    GPU_MEMORY_UTILIZATION=0.90
elif [[ "${MODEL_NAME}" == *"14b"* ]] || [[ "${MODEL_NAME}" == *"20b"* ]] || [[ "${MODEL_NAME}" == *"34b"* ]]; then
    MAX_MODEL_LEN=8192
    GPU_MEMORY_UTILIZATION=0.85
else
    MAX_MODEL_LEN=4096
    GPU_MEMORY_UTILIZATION=0.80
fi

echo "╔══════════════════════════════════════════════════════╗"
echo "║         EcoMind OS — vLLM 推理服务启动              ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  模型路径: ${MODEL_PATH}"
echo "║  模型名称: ${MODEL_NAME}"
echo "║  GPU 设备: ${GPU_IDS} (${NUM_GPUS} 张)"
echo "║  张量并行: ${TENSOR_PARALLEL}"
echo "║  最大长度: ${MAX_MODEL_LEN}"
echo "║  服务端口: ${PORT}"
echo "║  显存占用: ${GPU_MEMORY_UTILIZATION}"
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
    echo "       huggingface-cli download deepseek-ai/DeepSeek-R1 --local-dir ${MODEL_PATH}"
    exit 1
fi

# ---- 启动 vLLM ----
echo "[INFO] 正在启动 vLLM 服务..."

python -m vllm.entrypoints.openai.api_server \
    --model "${MODEL_PATH}" \
    --served-model-name "${MODEL_NAME}" \
    --host "${HOST}" \
    --port "${PORT}" \
    --tensor-parallel-size "${TENSOR_PARALLEL}" \
    --max-model-len "${MAX_MODEL_LEN}" \
    --gpu-memory-utilization "${GPU_MEMORY_UTILIZATION}" \
    --trust-remote-code \
    --dtype auto \
    --enable-prefix-caching \
    --disable-log-requests \
    --api-key "token-ecomind-vllm"

# ---- 健康检查 ----
echo "[INFO] 等待服务就绪..."
for i in $(seq 1 60); do
    if curl -s "http://localhost:${PORT}/health" > /dev/null 2>&1; then
        echo "[OK] vLLM 服务已就绪! http://localhost:${PORT}"
        echo "[INFO] 测试命令: curl http://localhost:${PORT}/v1/models"
        exit 0
    fi
    echo "等待中... ($i/60)"
    sleep 5
done

echo "[FAIL] vLLM 启动超时"
exit 1
