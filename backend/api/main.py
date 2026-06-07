"""
EcoMind OS FastAPI 应用入口

配置 CORS、lifespan 事件、路由注册、WebSocket 端点。
"""

from __future__ import annotations

import logging
import os
import traceback
from pathlib import Path

# 加载 .env 环境变量
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent.parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
        logging.getLogger(__name__).info(f"✅ 已加载环境变量: {_env_path}")
except ImportError:
    pass
import uuid
import signal
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routers import agents, workflows, security, models, departments, environment, enforcement, approval, compliance, reports, marketplace, knowledge_graph, safety_chain, knowledge, skills, tools, chat, media, upload, hunan_policy, team, calendar, learning
from api.agent_heartbeat import router as heartbeat_router
from api.websocket.manager import WebSocketManager

logger = logging.getLogger(__name__)

# 初始化分级日志（3级：agent.log / errors.log / system.log）
try:
    from engine.ecomind_logging import init_logging
    init_logging()
except Exception:
    pass

# 全局 WebSocket 管理器实例
ws_manager = WebSocketManager()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """应用生命周期管理：启动时初始化资源，关闭时清理资源。"""
    logger.info("EcoMind OS API 启动中...")
    # 数据库迁移
    try:
        from engine.migrations import run_migrations
        run_migrations()
    except Exception as e:
        logger.warning(f"数据库迁移跳过: {e}")
    # 启动时：初始化 EventBus 订阅、Agent 服务等
    ws_manager.start_background_broadcaster()
    # 启动 Agent 自动心跳（每30秒刷新，防止预注册Agent全部掉线）
    from api.agent_heartbeat import start_auto_heartbeat, stop_auto_heartbeat
    start_auto_heartbeat()
    logger.info("EcoMind OS API 已启动 ✓")
    # 启动配置热加载
    try:
        from engine.config_watcher import setup_config_watcher
        watcher = setup_config_watcher()
        await watcher.start(interval=30.0)
        logger.info("🔄 配置热加载已启动")
    except Exception as e:
        logger.warning(f"配置热加载启动失败: {e}")
    yield
    # 关闭时：清理 WebSocket 连接 + 停止自动心跳 + 停止配置监控
    await _graceful_shutdown()
    logger.info("EcoMind OS API 已关闭")


async def _graceful_shutdown() -> None:
    """优雅关闭：按顺序释放所有资源。"""
    drain_timeout = 30  # 最多等待 30 秒让正在进行的请求完成
    logger.info("收到关闭信号，正在优雅退出... (超时=%ds)", drain_timeout)

    # 1. 停止接收新连接
    try:
        from engine.ecomind_logging import log_stats as _log_stats
        stats = _log_stats()
        logger.info("日志统计: %s", stats)
    except Exception:
        pass

    # 2. 停止配置热加载
    try:
        from engine.config_watcher import ConfigWatcher
        await ConfigWatcher.get_instance().stop()
    except Exception:
        pass

    # 3. 停止自动心跳
    from api.agent_heartbeat import stop_auto_heartbeat
    stop_auto_heartbeat()

    # 4. 断开所有 WebSocket
    await ws_manager.disconnect_all()

    # 5. 等待进行中的 Agent 任务完成
    try:
        from engine.loop import _active_engines
        if _active_engines:
            logger.info("等待 %d 个活跃 Agent 引擎完成...", len(_active_engines))
            await asyncio.wait_for(
                asyncio.gather(*[e._drain() for e in _active_engines], return_exceptions=True),
                timeout=drain_timeout,
            )
    except asyncio.TimeoutError:
        logger.warning("关闭超时——强制终止剩余 Agent 任务")
    except Exception:
        pass

    logger.info("所有资源已释放 ✓")


def _setup_signal_handlers() -> None:
    """注册 SIGTERM / SIGINT 处理器——优雅关闭。"""
    def _signal_handler(sig, frame):
        logger.warning("收到信号 %s，触发优雅关闭...", sig)
        # 触发 FastAPI shutdown 事件
        import asyncio as _asyncio
        try:
            loop = _asyncio.get_event_loop()
            loop.call_soon_threadsafe(lambda: None)  # 唤醒事件循环
        except RuntimeError:
            pass

    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)


def _setup_deepseek_bridge(app: FastAPI) -> None:
    """
    前端 deepseek.ts → /deepseek/v1/chat/completions → EcoAgentEngine

    接受 OpenAI 兼容格式请求，内部走 EcoAgentEngine。
    流式返回 SSE，非流式返回标准 JSON。
    """
    import json as _json
    from fastapi import Request
    from fastapi.responses import StreamingResponse, JSONResponse
    from engine.loop import AgentConfig, AgentTier, EcoAgentEngine
    from engine.tool_registry import get_tool_registry as _get_registry

    @app.post("/deepseek/v1/chat/completions")
    async def deepseek_bridge(request: Request):
        body = await request.json()
        messages = body.get("messages", [])
        stream = body.get("stream", False)

        system_prompt = ""
        history_parts: list[str] = []
        current_user_message = ""

        for m in messages:
            role = m.get("role", "")
            content = m.get("content", "")
            if role == "system":
                system_prompt = content
            elif role == "user":
                if current_user_message:
                    history_parts.append(f"[用户]: {current_user_message[:300]}")
                current_user_message = content
            elif role == "assistant":
                if current_user_message:
                    history_parts.append(f"[用户]: {current_user_message[:300]}")
                    current_user_message = ""
                history_parts.append(f"[AI]: {content[:300]}")

        if history_parts:
            task = "[对话历史]\n" + "\n".join(history_parts[-12:]) + "\n\n[当前问题]\n" + current_user_message
        else:
            task = current_user_message

        config = AgentConfig(
            provider="deepseek",
            model=body.get("model", "deepseek-chat"),
            soul=system_prompt,
            temperature=body.get("temperature", 0.7),
            max_tokens=body.get("max_tokens", 4096),
            max_iterations=10,
            stream=True,
            tools=list(_get_registry()._tools.keys()),
            tier=AgentTier.SONNET,
            verify_enabled=True,
        )

        engine = EcoAgentEngine(config=config, tool_registry=_get_registry())

        if stream:
            async def sse_generator():
                full_text = ""
                recent_window: list[str] = []
                async for delta in engine.run_stream(task, system_prompt):
                    recent_window.append(delta)
                    if len(recent_window) > 15:
                        recent_window.pop(0)
                    recent_text = "".join(recent_window[-5:]) if len(recent_window) >= 5 else delta
                    if len(recent_text) >= 6 and len(full_text) >= len(recent_text):
                        if full_text.endswith(recent_text):
                            continue
                    full_text += delta
                    yield f"data: {_json.dumps({'choices': [{'delta': {'content': delta}, 'index': 0}]}, ensure_ascii=False)}\n\n"

                deduped = EcoAgentEngine._dedup_tail(full_text)
                yield "data: [DONE]\n\n"

            return StreamingResponse(
                sse_generator(),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )
        else:
            # 非流式：直接返回 JSON
            result = await engine.run(task, system_prompt)
            return JSONResponse(content={
                "choices": [{"message": {"content": result.content}, "finish_reason": "stop"}]
            })


def create_app() -> FastAPI:
    """创建并配置 FastAPI 应用实例。"""
    application = FastAPI(
        title="EcoMind OS API",
        description="EcoMind OS 后端服务 — Agent 管理、工作流、安全治理、模型路由",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS 配置 — 允许前端开发服务器跨域访问
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:4173",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Security headers middleware
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.responses import Response

    class SecurityHeadersMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            response: Response = await call_next(request)
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
            return response

    application.add_middleware(SecurityHeadersMiddleware)

    # 注册路由 — heartbeat 必须在 agents 之前，避免 /status 被 /{agent_id} 拦截
    application.include_router(heartbeat_router, prefix="/api/agents", tags=["Agent Heartbeat"])
    application.include_router(agents.router, prefix="/api/agents", tags=["Agents"])
    application.include_router(workflows.router, prefix="/api/workflows", tags=["Workflows"])
    application.include_router(security.router, prefix="/api/security", tags=["Security"])
    application.include_router(models.router, prefix="/api/models", tags=["Models"])

    # 🆕 部门智能体管理
    application.include_router(departments.router, prefix="/api/departments", tags=["Departments"])
    # 🆕 环境数据对接
    application.include_router(environment.router, prefix="/api/environment", tags=["Environment"])
    # 🆕 执法办案管理
    application.include_router(enforcement.router)
    # 环评审批管理
    application.include_router(approval.router)
    # 合规检查管理
    application.include_router(compliance.router)
    # 报告生成管理
    application.include_router(reports.router)

    # ─── 技能市场 (P2) ───
    application.include_router(marketplace.router)

    # ─── 知识图谱 (P2) ───
    application.include_router(knowledge_graph.router)

    # ─── SafetyChain 六层安全 (P2) ───
    application.include_router(safety_chain.router)

    # ─── 本地资料库 (P2) ───
    application.include_router(knowledge.router, prefix="/api/knowledge", tags=["Knowledge"])

    # ─── 技能 & 工具 (P0) ───
    application.include_router(skills.router, prefix="/api/skills", tags=["Skills"])
    application.include_router(tools.router, prefix="/api/tools", tags=["Tools"])

    # ─── 统一 Chat 引擎 (P0) ───
    application.include_router(chat.router, prefix="/api/chat", tags=["Chat"])

    # ─── 前端直连桥接：/deepseek/v1/chat/completions → EcoAgentEngine ───
    _setup_deepseek_bridge(application)

    # ─── 媒体服务 (语音播报/TTS) ───
    application.include_router(media.router, prefix="/api/media", tags=["Media"])

    # ─── 文件上传 (供 AI 工具分析) ───
    application.include_router(upload.router, prefix="/api/upload", tags=["Upload"])

    # ─── 湖南生态环境政策 MCP ───
    application.include_router(hunan_policy.router, prefix="/api/hunan-policy", tags=["Hunan Policy MCP"])

    # ─── 日历服务 ───
    application.include_router(calendar.router)

    # ─── 专家团队引擎 ───
    application.include_router(team.router, prefix="/api/team", tags=["Expert Team"])

    # ─── 学习与反馈引擎 (进化闭环) ───
    application.include_router(learning.router, prefix="/api/learning", tags=["Learning"])

    # ─── 消息网关 (飞书/微信/企微/钉钉) ───
    try:
        from gateway.router import router as gateway_router
        application.include_router(gateway_router)
    except ImportError as e:
        logger.warning("消息网关未加载: %s", e)

    # 注册 WebSocket 端点
    from api.websocket.manager import websocket_endpoint
    application.websocket_route("/ws")(websocket_endpoint)

    # 健康检查
    @application.get("/health", tags=["System"])
    async def health_check() -> dict[str, str]:
        """系统健康检查端点。"""
        return {"status": "ok", "service": "EcoMind OS API", "version": "1.0.0"}

    # 全局异常处理器 — 防止 SQL 错误、堆栈信息泄露给客户端
    @application.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        request_id = str(uuid.uuid4())[:8]
        logger.error(f"[{request_id}] 未处理异常: {type(exc).__name__}: {exc}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_server_error",
                "message": "服务器内部错误",
                "request_id": request_id,
            },
        )

    return application


app = create_app()
_setup_signal_handlers()
