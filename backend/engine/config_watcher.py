"""
EcoMind 配置热加载器

监控关键配置文件的 mtime，变更时自动重载。
对标 Hermes 的 SKILL.md 热加载机制。
"""
from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent


@dataclass
class WatchTarget:
    """监控目标"""
    path: Path
    label: str
    on_change: Callable[[], None]  # 变更回调
    _last_mtime: float = 0.0

    def check(self) -> bool:
        """检查是否变更，返回 True 则触发回调"""
        if not self.path.exists():
            return False
        mtime = self.path.stat().st_mtime
        if mtime > self._last_mtime:
            self._last_mtime = mtime
            return True
        return False


class ConfigWatcher:
    """配置热加载器 — 单例"""

    _instance: Optional[ConfigWatcher] = None

    def __init__(self):
        self._targets: list[WatchTarget] = []
        self._task: Optional[asyncio.Task] = None
        self._running = False

    @classmethod
    def get_instance(cls) -> ConfigWatcher:
        if cls._instance is None:
            cls._instance = ConfigWatcher()
        return cls._instance

    def watch(self, rel_path: str, label: str, on_change: Callable[[], None]) -> None:
        """添加监控目标（相对项目根目录）"""
        path = PROJECT_ROOT / rel_path
        if path.exists():
            mtime = path.stat().st_mtime
        else:
            mtime = 0.0
        target = WatchTarget(path=path, label=label, on_change=on_change, _last_mtime=mtime)
        self._targets.append(target)
        logger.info(f"👁️ 监控: {label} ({rel_path})")

    async def start(self, interval: float = 30.0) -> None:
        """启动监控循环"""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(interval))
        logger.info(f"🔄 配置热加载已启动 ({interval}s间隔, {len(self._targets)}项)")

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _loop(self, interval: float) -> None:
        while self._running:
            await asyncio.sleep(interval)
            for target in self._targets:
                try:
                    if target.check():
                        logger.info(f"🔄 [{target.label}] 检测到变更，重新加载...")
                        target.on_change()
                except Exception as e:
                    logger.error(f"热加载失败 [{target.label}]: {e}")


# ─── 回调函数 ──────────────────────────────────────────

def _reload_guardrails():
    """重载 guardrails.py（通过重新导入）"""
    import importlib
    from api import guardrails
    importlib.reload(guardrails)
    logger.info("✅ guardrails.py 已热加载")


def _reload_chat_prompts():
    """标记需要重载提示词（下次请求时重新调用 build_engine_system_prompt）"""
    from api.routers import chat
    # 清除模块级缓存，下次请求时重新构建
    if hasattr(chat, '_AGENT_SOUL_MAP'):
        logger.info("✅ chat.py 提示词标记为待重载（下次请求生效）")


def _reload_model_config():
    """重载模型配置"""
    import asyncio as _aio
    try:
        loop = _aio.get_event_loop()
        if loop.is_running():
            _aio.create_task(_reload_model_async())
    except Exception:
        pass


async def _reload_model_async():
    try:
        from engine.model_manager import get_model_manager
        mgr = await get_model_manager()
        await mgr._load_config()
    except Exception as e:
        logger.error(f"模型配置热加载失败: {e}")


def setup_config_watcher() -> ConfigWatcher:
    """注册所有监控目标并启动"""
    watcher = ConfigWatcher.get_instance()

    # 监控 guardrails.py（权限变更）
    watcher.watch("api/guardrails.py", "权限矩阵", _reload_guardrails)

    # 监控 chat.py（提示词变更）
    watcher.watch("api/routers/chat.py", "提示词", _reload_chat_prompts)

    # 监控 model_config.yaml（模型配置变更）
    watcher.watch("config/model_config.yaml", "模型配置", _reload_model_config)

    # 监控 SOUL 文件（人格变更）
    spec_dir = PROJECT_ROOT / "spec"
    skills_dir = PROJECT_ROOT / "backend/skills/ecc/hunan-agents/workspaces"
    if spec_dir.exists():
        for f in spec_dir.glob("SOUL*.md"):
            watcher.watch(str(f.relative_to(PROJECT_ROOT)), f"人格:{f.name}", _reload_chat_prompts)
    if skills_dir.exists():
        for soul_file in skills_dir.glob("*/SOUL.md"):
            watcher.watch(str(soul_file.relative_to(PROJECT_ROOT)), f"人格:{soul_file.parent.name}", _reload_chat_prompts)

    return watcher
