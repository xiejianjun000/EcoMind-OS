"""
EcoMind OS LiteLLM 代理服务
提供 OpenAI 兼容 API 端点，路由到不同的 LLM 后端
"""

import os
import sys
from pathlib import Path

# 设置环境变量默认值
CONFIG_DIR = Path(__file__).parent / "config"

def setup_env():
    """设置环境变量"""
    env_defaults = {
        "LITELLM_MASTER_KEY": "sk-ecomind-litellm-local",
        "OPENAI_API_BASE": "https://api.openai.com/v1",
        "OPENAI_API_KEY": "sk-placeholder",
        "VLLM_API_BASE": "http://localhost:8000/v1",
        "VLLM_API_KEY": "token-ecomind-vllm",
    }
    for key, default in env_defaults.items():
        if key not in os.environ:
            os.environ[key] = default


def start_proxy():
    """启动 LiteLLM 代理"""
    setup_env()

    config_path = CONFIG_DIR / "config.yaml"
    if not config_path.exists():
        print(f"[ERROR] 配置文件不存在: {config_path}")
        sys.exit(1)

    try:
        from litellm._cli.cli import run_server
        print(f"[OK] LiteLLM 代理启动中...")
        print(f"[OK] 配置文件: {config_path}")
        print(f"[OK] 端口: 4000")
        run_server(config_path=str(config_path), port=4000)
    except ImportError:
        print("[ERROR] LiteLLM 未安装: pip install litellm")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] 启动失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    start_proxy()
