"""
EcoMind OS Tool Executor — 12工具执行引擎

POST /api/tools/execute  — 主入口，接收 tool_name + params，执行并返回结果
GET  /api/tools/list      — 返回所有工具定义（JSON Schema）
GET  /api/tools/audit     — 查询审计日志
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

# 真实项目根目录（本文件在 backend/api/routers/ → 上四级到 EcoMind-OS/）
_ACTUAL_PROJECT_ROOT = os.environ.get(
    "PROJECT_ROOT",
    str(Path(__file__).resolve().parent.parent.parent.parent)
)
from pydantic import BaseModel, Field

from api.guardrails import (
    SafetyLevel,
    check_guardrail,
    confirm_execution,
    reject_execution,
    get_audit_logs,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── 请求/响应模型 ─────────────────────────────────────────────

class ToolExecuteRequest(BaseModel):
    tool_name: str
    tool_params: dict[str, Any] = Field(default_factory=dict)
    expert_id: str = "ecomind"
    safety_level: str = "L2"
    user_id: str = "anonymous"

class ToolExecuteResponse(BaseModel):
    tool_name: str
    status: str  # "success" | "error" | "pending_confirmation"
    data: Any = None
    summary: str = ""
    error: str | None = None
    duration_ms: int = 0
    require_human_confirm: bool = False
    audit_id: str | None = None


# ─── 工具 1: env_query ────────────────────────────────────────

async def _env_query(params: dict) -> dict:
    """查询实时环境监测数据 — 对接湖南省环境监测平台 hn.leitesoft.cn"""
    city = params.get("city", "长沙市")

    try:
        from api.services.environment_service import (
            get_realtime_aqi, get_city_hourly_detail
        )
        if city and city != "all":
            detail = await get_city_hourly_detail(city)
            flat = {
                "city": city,
                "source": "湖南省环境监测平台",
                "status": "ok",
            }
            if isinstance(detail, dict):
                for k in ("aqi", "level", "pm25", "pm10", "o3", "no2", "so2", "co",
                           "primary_pollutant", "primary", "primaryPollutant",
                           "forecast_aqi", "forecast_level"):
                    if k in detail:
                        flat[k] = detail[k]
                flat["raw"] = detail
            return flat

        all_cities = await get_realtime_aqi()
        target = next(
            (c for c in all_cities if city in c.get("city", "")),
            all_cities[0] if all_cities else {}
        )
        return {
            "city": city,
            "aqi": target.get("aqi"),
            "level": target.get("level", "—"),
            "pm25": target.get("pm25"),
            "pm10": target.get("pm10"),
            "o3": target.get("o3"),
            "no2": target.get("no2"),
            "so2": target.get("so2"),
            "co": target.get("co"),
            "primary_pollutant": target.get("primary", target.get("primaryPollutant", "—")),
            "cities": all_cities,
            "source": "湖南省环境监测平台",
        }
    except Exception as e:
        logger.warning(f"env_query failed for {city}: {e}")
        return {"city": city, "status": "unavailable", "message": f"无法获取 {city} 实时数据: {e}"}


# ─── 工具 2: regulation_search ─────────────────────────────────

async def _regulation_search(params: dict) -> dict:
    """检索法规标准库 — 对接 search_knowledge + 内置法规数据库"""
    query = params.get("query", "")
    domain = params.get("domain", "all")
    max_results = params.get("max_results", 5)

    try:
        from api.services.knowledge_service import search_knowledge
        results = await search_knowledge(query, top_k=max_results, category="regulations")
        return {
            "query": query,
            "domain": domain,
            "results_count": len(results),
            "results": results,
            "source": "本地知识库 + 内置法规库",
        }
    except Exception as e:
        logger.warning(f"regulation_search failed: {e}")
        return {
            "query": query,
            "domain": domain,
            "results_count": 0,
            "results": [],
            "note": f"法规检索失败: {e}",
        }


# ─── 工具 3: report_generate ───────────────────────────────────

async def _report_generate(params: dict) -> dict:
    """生成报告"""
    template = params.get("template", "monitoring_daily")
    city = params.get("city", "")
    fmt = params.get("format", "markdown")

    # 模板 → 标题映射
    titles = {
        "monitoring_daily": f"{city}环境监测日报",
        "monitoring_weekly": f"{city}环境监测周报",
        "enforcement_decision": "行政处罚决定书（草稿）",
        "eia_review": "环评审查意见书",
        "emergency_plan": "突发环境事件应急预案",
        "inspection_report": "生态督察报告",
    }

    report_id = f"rpt-{int(time.time())}"
    return {
        "report_id": report_id,
        "title": titles.get(template, "环境报告"),
        "template": template,
        "format": fmt,
        "status": "generated",
        "note": "报告模板引擎对接中，当前返回结构骨架",
    }


# ─── 工具 4-12: 占位实现（逐步完善）────────────────────────────

async def _case_search(params: dict) -> dict:
    return {"query": params.get("query", ""), "results": [], "note": "案例库对接中"}

async def _map_visualize(params: dict) -> dict:
    return {"map_type": params.get("map_type"), "config": {}, "note": "地图引擎对接中"}

async def _alert_check(params: dict) -> dict:
    return {"alerts": [], "count": 0, "note": "告警系统对接中"}

async def _document_parse(params: dict) -> dict:
    """解析上传文档（OCR/PDF/Word）— 委托给 document_ocr 实现"""
    return await _document_ocr(params)

async def _compliance_check(params: dict) -> dict:
    return {"target": params.get("target_description"), "result": "pending", "note": "合规引擎对接中"}

async def _data_analyze(params: dict) -> dict:
    return {"analysis_type": params.get("analysis_type"), "result": {}, "note": "分析引擎对接中"}

async def _dispatch_expert(params: dict) -> dict:
    """真调度：启动独立专家子任务，返回 task_id 供后续查询"""
    from engine.team_engine import get_team_engine
    import os

    engine = get_team_engine()
    expert_id = params.get("expert_id", "ecomind")
    expert_name = params.get("expert_name", expert_id)
    task_description = params.get("task_description", params.get("task", ""))

    # 获取该专家的工具白名单
    from api.guardrails import EXPERT_TOOL_MATRIX
    allowed_tools = list(EXPERT_TOOL_MATRIX.get(expert_id, set()))

    # 构建专家专用 system prompt
    from api.routers.chat import build_engine_system_prompt
    system_prompt = build_engine_system_prompt(expert_id, expert_name)

    api_key = os.environ.get("DEEPSEEK_API_KEY", "")
    api_base = os.environ.get("DEEPSEEK_API_BASE", "https://api.deepseek.com/v1")

    task_id = await engine.dispatch(
        expert_id=expert_id,
        expert_name=expert_name,
        message=task_description,
        system_prompt=system_prompt,
        tools=allowed_tools,
        api_key=api_key,
        api_base=api_base,
    )

    return {
        "task_id": task_id,
        "expert_id": expert_id,
        "expert_name": expert_name,
        "task": task_description,
        "status": "dispatched",
        "note": "专家子任务已启动，可通过 GET /api/team/tasks/{task_id} 查询进度",
    }

async def _knowledge_query(params: dict) -> dict:
    """查询知识库（法规/案例/物种） — 对接 search_knowledge"""
    query = params.get("query", "")
    database = params.get("database", "all")
    try:
        from api.services.knowledge_service import search_knowledge
        results = await search_knowledge(query, top_k=8, category=database)
        return {
            "query": query,
            "database": database,
            "results_count": len(results),
            "results": results,
            "source": "本地知识库 + 内置法规库",
        }
    except Exception as e:
        return {"query": query, "results": [], "note": f"知识库查询失败: {e}"}

async def _skill_execute(params: dict) -> dict:
    skill_id = params.get("skill_id")
    return {
        "skill_id": skill_id,
        "status": "executed",
        "note": f"技能 {skill_id} 执行引擎对接中",
    }


# ─── 工具 13-18: 代码开发工具（仅 ecomind 可用，L3 必须确认）───

async def _code_read(params: dict) -> dict:
    import os
    file_path = params.get("file_path", "")
    project_root = _ACTUAL_PROJECT_ROOT
    full_path = os.path.normpath(os.path.join(project_root, file_path))
    if not full_path.startswith(os.path.normpath(project_root)):
        raise HTTPException(status_code=403, detail="不允许访问项目目录外的文件")
    if not os.path.exists(full_path):
        return {"file_path": file_path, "exists": False}
    try:
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {
            "file_path": file_path, "exists": True,
            "content": content[:10000], "lines": len(content.split("\n")),
            "truncated": len(content) > 10000,
        }
    except Exception as e:
        return {"file_path": file_path, "exists": True, "error": str(e)}

async def _code_edit(params: dict) -> dict:
    import os, difflib
    file_path = params.get("file_path", "")
    old_string = params.get("old_string", "")
    new_string = params.get("new_string", "")
    project_root = _ACTUAL_PROJECT_ROOT
    full_path = os.path.normpath(os.path.join(project_root, file_path))
    if not full_path.startswith(os.path.normpath(project_root)):
        raise HTTPException(status_code=403, detail="不允许访问项目目录外的文件")
    if not os.path.exists(full_path):
        return {"status": "error", "reason": "文件不存在"}
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    if old_string not in content:
        return {"status": "error", "reason": "old_string未在文件中找到", "suggestion": "使用code_read重新读取"}
    new_content = content.replace(old_string, new_string, 1)
    diff = list(difflib.unified_diff(
        content.splitlines(keepends=True), new_content.splitlines(keepends=True),
        fromfile=file_path, tofile=file_path))
    # 实际写入
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    return {"status": "patched", "file_path": file_path,
            "lines_changed": len(diff),
            "note": "✅ 文件已实际修改"}

async def _code_write(params: dict) -> dict:
    """写入文件（真实写入）"""
    import os
    file_path = params.get("file_path", "")
    content = params.get("content", "")
    if not file_path:
        raise HTTPException(status_code=400, detail="缺少 file_path 参数")
    project_root = _ACTUAL_PROJECT_ROOT
    full_path = os.path.abspath(file_path if os.path.isabs(file_path) else os.path.join(project_root, file_path))
    # 安全边界：允许项目目录 + /tmp
    safe_roots = [os.path.normpath(project_root), "/tmp"]
    if not any(full_path.startswith(r) for r in safe_roots):
        raise HTTPException(status_code=403, detail="不允许访问项目目录外的文件")
    try:
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        return {"status": "created", "file_path": full_path,
                "size_bytes": len(content.encode("utf-8")),
                "lines": len(content.split("\n"))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"写入失败: {str(e)}")

async def _shell_exec(params: dict) -> dict:
    import subprocess, os
    command = params.get("command", "")
    cwd = params.get("cwd", _ACTUAL_PROJECT_ROOT)
    ALLOWED = ["npm ", "npx ", "git ", "tsc", "vite", "python", "pip", "ls", "cat", "head", "tail", "wc", "find", "grep", "node ", "echo ", "pwd", "whoami", "date"]
    BLOCKED = ["rm ", "sudo", "chmod", "chown", "curl", "wget", ">", "&&", "|", ";", "$(", "`"]
    if not any(command.lower().strip().startswith(p) for p in ALLOWED):
        return {"status": "blocked", "reason": "命令不在白名单中"}
    if any(p in command for p in BLOCKED):
        return {"status": "blocked", "reason": "命令包含禁止模式"}
    try:
        result = subprocess.run(command, shell=True, cwd=cwd, capture_output=True, text=True, timeout=30)
        return {"status": "completed", "command": command, "exit_code": result.returncode,
                "stdout": result.stdout[:5000], "stderr": result.stderr[:2000]}
    except subprocess.TimeoutExpired:
        return {"status": "timeout", "reason": "超时30秒"}
    except Exception as e:
        return {"status": "error", "reason": str(e)}

async def _git_status(params: dict) -> dict:
    import subprocess, os
    project_root = _ACTUAL_PROJECT_ROOT
    try:
        s = subprocess.run("git status --short", shell=True, cwd=project_root, capture_output=True, text=True, timeout=10)
        b = subprocess.run("git branch --show-current", shell=True, cwd=project_root, capture_output=True, text=True, timeout=5)
        l = subprocess.run("git log --oneline -5", shell=True, cwd=project_root, capture_output=True, text=True, timeout=10)
        return {"branch": b.stdout.strip(), "status": s.stdout.strip() or "clean",
                "recent_commits": l.stdout.strip().split("\n") if l.stdout.strip() else []}
    except Exception as e:
        return {"error": str(e)}

async def _git_commit(params: dict) -> dict:
    import subprocess, os
    project_root = _ACTUAL_PROJECT_ROOT
    message = params.get("message", "AI: code change")
    branch_name = params.get("branch_name", f"ai/auto-{int(time.time())}")
    try:
        diff = subprocess.run("git diff", shell=True, cwd=project_root, capture_output=True, text=True, timeout=10)
        staged = subprocess.run("git diff --cached", shell=True, cwd=project_root, capture_output=True, text=True, timeout=10)
        full_diff = (staged.stdout + diff.stdout).strip()
        if not full_diff:
            return {"status": "no_changes", "message": "没有待提交的变更"}
        return {"status": "preview", "branch_name": branch_name, "commit_message": message,
                "diff": full_diff[:8000], "note": "⚠️ 提交预览，未实际提交。确认后执行。"}
    except Exception as e:
        return {"status": "error", "reason": str(e)}


# ─── 工具 19-22: 多模态分析工具 ─────────────────────────────────

async def _image_analyze(params: dict) -> dict:
    """
    分析图片内容 — 支持无人机航拍、监控截图、污染现场照片、地图标注。
    使用 OpenCV + PIL + Tesseract OCR 进行多层次分析。
    """
    import os, subprocess
    file_path = params.get("file_path", "")
    analysis_type = params.get("analysis_type", "general")

    if not file_path or not os.path.exists(file_path):
        return {"status": "error", "reason": f"文件不存在: {file_path}"}

    result = {
        "file_path": file_path,
        "file_name": os.path.basename(file_path),
        "analysis_type": analysis_type,
    }

    try:
        import cv2
        import numpy as np
        from PIL import Image, ExifTags

        img = cv2.imread(file_path)
        if img is None:
            return {"status": "error", "reason": f"无法读取图片: {file_path}"}

        h, w, c = img.shape
        result.update({
            "dimensions": {"width": w, "height": h, "channels": c},
            "file_size_kb": round(os.path.getsize(file_path) / 1024, 1),
        })

        # EXIF 元数据提取
        try:
            pil_img = Image.open(file_path)
            exif_data = pil_img._getexif()
            if exif_data:
                exif = {}
                for tag_id, value in exif_data.items():
                    tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                    if isinstance(value, bytes):
                        value = f"<{len(value)} bytes>"
                    exif[tag_name] = str(value)
                result["exif"] = exif
        except Exception:
            pass

        # 颜色分析
        mean_color = cv2.mean(img)
        result["color_analysis"] = {
            "mean_bgr": [round(v, 1) for v in mean_color[:3]],
            "brightness": round(sum(mean_color[:3]) / 3, 1),
        }

        # 亮度判定（用于污染识别 — 黑烟/浓烟会降低亮度）
        brightness = result["color_analysis"]["brightness"]
        if brightness < 60:
            result["color_analysis"]["note"] = "图像偏暗 — 可能为夜间拍摄或浓烟场景"
        elif brightness > 200:
            result["color_analysis"]["note"] = "图像偏亮 — 可能为白天晴好天气"

        # 边缘检测（结构分析）
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        edge_density = np.mean(edges > 0)
        result["structure_analysis"] = {
            "edge_density": round(edge_density, 4),
            "interpretation": (
                "图像细节丰富，轮廓清晰" if edge_density > 0.15
                else "图像较平滑，细节较少" if edge_density > 0.05
                else "图像模糊或大面积单一色调"
            ),
        }

        # 污染检测（简易颜色阈值）
        if analysis_type in ("pollution", "general"):
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

            # 黑烟检测（低亮度 + 低饱和度）
            dark_mask = cv2.inRange(hsv, (0, 0, 0), (180, 50, 80))
            dark_ratio = np.mean(dark_mask > 0)

            # 黄烟/棕烟检测
            brown_mask = cv2.inRange(hsv, (10, 40, 40), (30, 255, 200))
            brown_ratio = np.mean(brown_mask > 0)

            # 绿色植被检测
            green_mask = cv2.inRange(hsv, (35, 40, 40), (85, 255, 255))
            green_ratio = np.mean(green_mask > 0)

            # 水体检测（蓝色区域）
            blue_mask = cv2.inRange(hsv, (90, 40, 40), (130, 255, 255))
            blue_ratio = np.mean(blue_mask > 0)

            result["environment_analysis"] = {
                "dark_smoke_pct": round(dark_ratio * 100, 1),
                "brown_smoke_pct": round(brown_ratio * 100, 1),
                "vegetation_pct": round(green_ratio * 100, 1),
                "water_pct": round(blue_ratio * 100, 1),
            }

            # 异常告警
            alerts = []
            if dark_ratio > 0.15:
                alerts.append("⚠️ 检测到大面积暗色区域，可能存在黑烟/浓烟排放")
            if brown_ratio > 0.1:
                alerts.append("⚠️ 检测到棕黄色区域，可能存在扬尘/黄烟")
            if alerts:
                result["environment_analysis"]["alerts"] = alerts

        # OCR 文字提取（优先 CLI，避免 pytesseract numpy 兼容问题）
        if analysis_type in ("general", "ocr"):
            try:
                ocr_result = subprocess.run(
                    ["tesseract", file_path, "stdout", "-l", "chi_sim+eng", "--psm", "3"],
                    capture_output=True, timeout=15,
                )
                ocr_text = ocr_result.stdout.decode("utf-8", errors="replace").strip()
                if ocr_text:
                    result["ocr_text"] = ocr_text[:2000]
                    result["ocr_text_length"] = len(ocr_text)
            except Exception:
                pass  # OCR 是可选的增强功能

        result["status"] = "success"
        return result

    except ImportError as e:
        return {"status": "error", "reason": f"缺少依赖库: {e}", "hint": "pip install opencv-python pillow"}
    except Exception as e:
        logger.error(f"image_analyze failed: {e}")
        return {"status": "error", "reason": str(e)}


async def _video_analyze(params: dict) -> dict:
    """
    分析视频内容 — 无人机录像、监控视频、排污口记录。
    使用 ffmpeg 提取关键帧 + OpenCV 逐帧分析。
    """
    import os, subprocess, tempfile, json as _json

    file_path = params.get("file_path", "")
    extract_frames = min(params.get("extract_frames", 5), 20)
    analysis_type = params.get("analysis_type", "general")

    if not file_path or not os.path.exists(file_path):
        return {"status": "error", "reason": f"文件不存在: {file_path}"}

    result = {
        "file_path": file_path,
        "file_name": os.path.basename(file_path),
        "analysis_type": analysis_type,
    }

    try:
        # 1. 使用 ffprobe 获取视频元数据
        probe_cmd = [
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_format", "-show_streams", file_path
        ]
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=15)
        if probe_result.returncode == 0:
            probe_data = _json.loads(probe_result.stdout)
            fmt = probe_data.get("format", {})
            result["metadata"] = {
                "duration_seconds": round(float(fmt.get("duration", 0)), 1),
                "size_mb": round(float(fmt.get("size", 0)) / (1024 * 1024), 1),
                "format": fmt.get("format_name", "unknown"),
            }
            for stream in probe_data.get("streams", []):
                if stream["codec_type"] == "video":
                    # 安全计算 fps
                    rfr = stream.get("r_frame_rate", "0/1")
                    try:
                        num, den = rfr.split("/")
                        fps = round(float(num) / float(den), 2) if float(den) != 0 else 0
                    except (ValueError, ZeroDivisionError):
                        fps = 0
                    result["metadata"].update({
                        "codec": stream.get("codec_name", "unknown"),
                        "resolution": f"{stream.get('width')}x{stream.get('height')}",
                        "fps": fps,
                        "bitrate_kbps": round(int(stream.get("bit_rate", 0)) / 1000) if stream.get("bit_rate") else None,
                    })
                    break

        # 2. 提取关键帧
        frames = []
        with tempfile.TemporaryDirectory() as tmpdir:
            duration = result["metadata"]["duration_seconds"]
            interval = max(1, duration / (extract_frames + 1))

            for i in range(extract_frames):
                timestamp = interval * (i + 1)
                frame_path = os.path.join(tmpdir, f"frame_{i:03d}.jpg")
                ffmpeg_cmd = [
                    "ffmpeg", "-y", "-ss", str(timestamp), "-i", file_path,
                    "-vframes", "1", "-q:v", "3", frame_path
                ]
                subprocess.run(ffmpeg_cmd, capture_output=True, timeout=10)

                if os.path.exists(frame_path):
                    try:
                        import cv2
                        import numpy as np
                        f_img = cv2.imread(frame_path)
                        if f_img is not None:
                            h, w = f_img.shape[:2]
                            gray = cv2.cvtColor(f_img, cv2.COLOR_BGR2GRAY)
                            mean_brightness = float(np.mean(gray))
                            std_brightness = float(np.std(gray))

                            frames.append({
                                "frame_index": i,
                                "timestamp_seconds": round(timestamp, 1),
                                "brightness_mean": round(mean_brightness, 1),
                                "brightness_std": round(std_brightness, 1),
                                "activity_level": (
                                    "高" if std_brightness > 60
                                    else "中" if std_brightness > 30
                                    else "低"
                                ),
                            })
                    except ImportError:
                        frames.append({"frame_index": i, "timestamp_seconds": round(timestamp, 1)})

        result["frames"] = frames[:extract_frames]
        result["frames_extracted"] = len(frames)

        # 3. 运动/变化检测（基于帧间亮度变化）
        if len(frames) >= 2 and "brightness_mean" in frames[0]:
            brightness_changes = [
                abs(frames[i]["brightness_mean"] - frames[i - 1]["brightness_mean"])
                for i in range(1, len(frames))
            ]
            avg_change = sum(brightness_changes) / len(brightness_changes) if brightness_changes else 0

            result["motion_analysis"] = {
                "avg_brightness_change": round(avg_change, 1),
                "interpretation": (
                    "画面变化剧烈 — 可能有快速移动物体或场景切换" if avg_change > 20
                    else "画面适中变化" if avg_change > 8
                    else "画面基本静止 — 监控/固定视角"
                ),
            }

            # 异常告警
            if avg_change > 30:
                result["motion_analysis"]["alert"] = "⚠️ 画面剧烈变化，建议人工查看原始视频确认是否异常排放"

        result["status"] = "success"
        return result

    except Exception as e:
        logger.error(f"video_analyze failed: {e}")
        return {"status": "error", "reason": str(e)}


async def _voice_transcribe(params: dict) -> dict:
    """
    语音转文字 — 会议录音、现场报告、执法记录。
    优先使用 macOS 系统语音识别，其次尝试 whisper，最后回退 ffmpeg 元信息。
    """
    import os, subprocess, tempfile

    file_path = params.get("file_path", "")
    language = params.get("language", "auto")

    if not file_path or not os.path.exists(file_path):
        return {"status": "error", "reason": f"文件不存在: {file_path}"}

    result = {
        "file_path": file_path,
        "file_name": os.path.basename(file_path),
        "language": language,
    }

    try:
        import subprocess
        # 获取音频元信息
        probe_cmd = [
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_format", "-show_streams", file_path
        ]
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=10)
        if probe_result.returncode == 0:
            import json as _json
            probe_data = _json.loads(probe_result.stdout)
            fmt = probe_data.get("format", {})
            result["metadata"] = {
                "duration_seconds": round(float(fmt.get("duration", 0)), 1),
                "format": fmt.get("format_name", "unknown"),
                "size_mb": round(float(fmt.get("size", 0)) / (1024 * 1024), 1),
            }
            for stream in probe_data.get("streams", []):
                if stream["codec_type"] == "audio":
                    result["metadata"].update({
                        "codec": stream.get("codec_name", "unknown"),
                        "sample_rate": stream.get("sample_rate"),
                        "channels": stream.get("channels"),
                        "bitrate_kbps": round(int(stream.get("bit_rate", 0)) / 1000) if stream.get("bit_rate") else None,
                    })
                    break

        # 尝试 macOS 内建语音识别 (say 的反向操作不可用，尝试 shortcuts)
        # 策略：先转 WAV 再尝试识别
        transcription_text = None
        method_used = None

        # 方法1: 尝试 whisper (如果已安装)
        try:
            import whisper
            model = whisper.load_model("base")
            audio_result = model.transcribe(file_path, language=language if language != "auto" else None)
            transcription_text = audio_result["text"]
            method_used = "whisper"
        except ImportError:
            pass

        # 方法2: 尝试使用 ffmpeg 提取音频信息（回退方案）
        if transcription_text is None:
            # 使用 ffmpeg 检测静音段和音量信息作为分析
            silence_cmd = [
                "ffmpeg", "-i", file_path, "-af",
                "silencedetect=n=-30dB:d=1.0", "-f", "null", "-"
            ]
            silence_result = subprocess.run(silence_cmd, capture_output=True, text=True, timeout=30)
            silence_lines = [l for l in silence_result.stderr.split("\n") if "silence" in l.lower()]

            vol_cmd = [
                "ffmpeg", "-i", file_path, "-af",
                "volumedetect", "-f", "null", "-"
            ]
            vol_result = subprocess.run(vol_cmd, capture_output=True, text=True, timeout=30)
            vol_lines = [l for l in vol_result.stderr.split("\n") if "vol" in l.lower()]

            result["audio_analysis"] = {
                "silence_segments": len(silence_lines),
                "volume_info": [l.strip() for l in vol_lines if "mean_volume" in l or "max_volume" in l],
            }
            method_used = "ffmpeg_analysis"

            # 尝试用 macOS osascript 调用系统语音识别
            try:
                # macOS 13+ 有 Shortcuts 命令可调用语音识别
                # 如果没有 whisper，给出明确指引
                pass
            except Exception:
                pass

        if transcription_text:
            result["transcription"] = transcription_text[:5000]
            result["transcription_length"] = len(transcription_text)
            result["method"] = method_used
        else:
            result["transcription"] = None
            result["method"] = method_used
            result["note"] = (
                "语音转文字需要安装 OpenAI Whisper。\n"
                "安装方法: pip install openai-whisper\n"
                "当前已提取音频特征信息，可用于判断是否有语音内容。"
            )

        result["status"] = "success"
        return result

    except Exception as e:
        logger.error(f"voice_transcribe failed: {e}")
        return {"status": "error", "reason": str(e)}


async def _document_ocr(params: dict) -> dict:
    """
    文档OCR识别 — 扫描件/PDF/图片中的文字提取。
    使用 Tesseract OCR 引擎，支持中英文混合识别。
    """
    import os, subprocess, tempfile

    file_path = params.get("file_path", "")
    output_format = params.get("output_format", "text")

    if not file_path or not os.path.exists(file_path):
        return {"status": "error", "reason": f"文件不存在: {file_path}"}

    result = {
        "file_path": file_path,
        "file_name": os.path.basename(file_path),
        "output_format": output_format,
    }

    try:
        ext = os.path.splitext(file_path)[1].lower()

        # PDF 需要先转图片
        ocr_input_path = file_path
        if ext == '.pdf':
            with tempfile.TemporaryDirectory() as tmpdir:
                # 用 ghostscript 或 imagemagick 转 PDF 为图片
                # 先尝试 pdftoppm (poppler)
                try:
                    png_path = os.path.join(tmpdir, "page")
                    subprocess.run(
                        ["pdftoppm", "-png", "-f", "1", "-l", "3", "-r", "200", file_path, png_path],
                        capture_output=True, timeout=20
                    )
                    png_files = sorted([f for f in os.listdir(tmpdir) if f.endswith('.png')])
                    if png_files:
                        ocr_input_path = os.path.join(tmpdir, png_files[0])
                except Exception:
                    return {"status": "error", "reason": "PDF OCR 需要 pdftoppm (poppler-utils)。brew install poppler"}

        # 执行 Tesseract OCR（通过 CLI，避免 pytesseract numpy 兼容问题）
        try:
            cmd_result = subprocess.run(
                ["tesseract", ocr_input_path, "stdout", "-l", "chi_sim+eng", "--psm", "3"],
                capture_output=True, timeout=30,
            )
            ocr_text = cmd_result.stdout.decode("utf-8", errors="replace").strip()

            if ocr_text:
                result["ocr_text"] = ocr_text[:3000]
                result["ocr_text_length"] = len(ocr_text)

                # 结构化提取（尝试识别表格/键值对）
                if output_format == "structured":
                    lines = [l.strip() for l in ocr_text.split("\n") if l.strip()]
                    result["line_count"] = len(lines)
                    import re
                    kv_pairs = {}
                    for line in lines:
                        kv_match = re.match(r'^(.{1,30})[：:]\s*(.+)', line)
                        if kv_match:
                            kv_pairs[kv_match.group(1).strip()] = kv_match.group(2).strip()
                    if kv_pairs:
                        result["key_value_pairs"] = kv_pairs
                    result["lines"] = lines[:50]

        except Exception as e:
            logger.warning(f"document_ocr tesseract failed: {e}")
            result["ocr_note"] = f"OCR 识别失败: {e}"
            result["ocr_text"] = ""
            result["ocr_text_length"] = 0

        result["status"] = "success"
        return result

    except Exception as e:
        logger.error(f"document_ocr failed: {e}")
        return {"status": "error", "reason": str(e)}


# ─── 湖南生态环境政策 MCP 工具（通过 GovMCPServer 调用）─────

def _get_govmcp_server():
    """懒加载 GovMCPServer 单例"""
    from govmcp.server import GovMCPServer
    if not hasattr(_get_govmcp_server, "_instance"):
        _get_govmcp_server._instance = GovMCPServer()
    return _get_govmcp_server._instance


async def _call_govmcp_tool(tool_name: str, arguments: dict) -> dict:
    """通过 GovMCPServer 调用 Hunan 政策工具"""
    import json as _json
    try:
        mcp_server = _get_govmcp_server()
        result_str = await mcp_server.call_tool(tool_name, arguments)
        result = _json.loads(result_str)
        if isinstance(result, dict) and "error" in result:
            return {"status": "error", "reason": result["error"]}
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"GovMCP call {tool_name} failed: {e}")
        return {"status": "error", "reason": str(e)}


async def _hunan_policy_search(params: dict) -> dict:
    """搜索湖南省生态环境厅政策法规"""
    return await _call_govmcp_tool("hunan_policy_search", {
        "query": params.get("query", ""),
        "section": params.get("section"),
        "limit": params.get("limit", 10),
    })


async def _hunan_policy_latest(params: dict) -> dict:
    """获取湖南省生态环境厅最新政策列表"""
    return await _call_govmcp_tool("hunan_policy_latest", {
        "days": params.get("days", 7),
        "section": params.get("section"),
        "limit": params.get("limit", 10),
    })


async def _hunan_policy_detail(params: dict) -> dict:
    """查看湖南省生态环境政策文件详情"""
    return await _call_govmcp_tool("hunan_policy_detail", {
        "article_id": params.get("article_id", ""),
    })


async def _hunan_policy_crawl(params: dict) -> dict:
    """从湖南省生态环境厅官网抓取最新政策"""
    return await _call_govmcp_tool("hunan_policy_crawl", {
        "sections": params.get("sections"),
        "days_back": params.get("days_back", 7),
        "max_pages": params.get("max_pages", 3),
    })


# ─── 工具注册表 ────────────────────────────────────────────────

TOOL_REGISTRY: dict[str, callable] = {
    "env_query": _env_query,
    "regulation_search": _regulation_search,
    "report_generate": _report_generate,
    "case_search": _case_search,
    "map_visualize": _map_visualize,
    "alert_check": _alert_check,
    "document_parse": _document_parse,
    "compliance_check": _compliance_check,
    "data_analyze": _data_analyze,
    "dispatch_expert": _dispatch_expert,
    "knowledge_query": _knowledge_query,
    "skill_execute": _skill_execute,
    "code_read": _code_read,
    "code_edit": _code_edit,
    "code_write": _code_write,
    "shell_exec": _shell_exec,
    "git_status": _git_status,
    "git_commit": _git_commit,
    # 多模态分析工具
    "image_analyze": _image_analyze,
    "video_analyze": _video_analyze,
    "voice_transcribe": _voice_transcribe,
    "document_ocr": _document_ocr,
    # 湖南生态环境政策 MCP 工具
    "hunan_policy_search": _hunan_policy_search,
    "hunan_policy_latest": _hunan_policy_latest,
    "hunan_policy_detail": _hunan_policy_detail,
    "hunan_policy_crawl": _hunan_policy_crawl,
}


# ─── API 端点 ──────────────────────────────────────────────────

@router.post("/execute", response_model=ToolExecuteResponse)
async def execute_tool(req: ToolExecuteRequest):
    """执行工具调用（核心端点）"""
    t0 = time.time()

    # 1. Guardrail 校验
    try:
        sl = SafetyLevel(req.safety_level)
    except ValueError:
        sl = SafetyLevel.L2

    gr = check_guardrail(
        expert_id=req.expert_id,
        tool_name=req.tool_name,
        tool_params=req.tool_params,
        safety_level=sl,
        user_id=req.user_id,
    )

    if not gr.allowed:
        raise HTTPException(status_code=403, detail=gr.reason)

    # 2. 如需人工确认，返回 pending 状态
    if gr.require_human_confirm:
        audit_id = f"audit-{int(time.time())}"
        return ToolExecuteResponse(
            tool_name=req.tool_name,
            status="pending_confirmation",
            summary=f"操作需要人工确认：{req.tool_name}（{sl.value}级别）",
            require_human_confirm=True,
            audit_id=audit_id,
            duration_ms=int((time.time() - t0) * 1000),
        )

    # 3. 执行工具
    handler = TOOL_REGISTRY.get(req.tool_name)
    if not handler:
        # 回退到全局工具注册表（Hermes 工具等）
        from engine.tool_registry import get_tool_registry
        reg = get_tool_registry()
        tool = reg.get(req.tool_name)
        if tool:
            try:
                result = await reg.execute(req.tool_name, **req.tool_params)
                return ToolExecuteResponse(
                    tool_name=req.tool_name,
                    status="success",
                    summary=str(result)[:500],
                    data=result if isinstance(result, dict) else {"output": str(result)},
                    duration_ms=int((time.time() - t0) * 1000),
                )
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"工具执行失败: {e}")
        raise HTTPException(status_code=400, detail=f"未知工具: {req.tool_name}")

    try:
        result = await handler(req.tool_params)
        duration_ms = int((time.time() - t0) * 1000)

        # 审计
        if gr.audit_entry:
            gr.audit_entry["result"] = "success"
            from api.guardrails import write_audit_log
            write_audit_log(gr.audit_entry)

        return ToolExecuteResponse(
            tool_name=req.tool_name,
            status="success",
            data=result,
            summary=result.get("summary", f"{req.tool_name} 执行成功"),
            duration_ms=duration_ms,
        )
    except Exception as e:
        logger.error(f"Tool {req.tool_name} failed: {e}")
        return ToolExecuteResponse(
            tool_name=req.tool_name,
            status="error",
            error=str(e),
            duration_ms=int((time.time() - t0) * 1000),
        )


@router.post("/confirm")
async def confirm_tool( audit_id: str, confirmed: bool = True):
    """人工确认 / 拒绝 L3 操作"""
    if confirmed:
        confirm_execution({"audit_id": audit_id}, "human_confirmed")
        return {"status": "confirmed", "audit_id": audit_id}
    else:
        reject_execution({"audit_id": audit_id})
        return {"status": "rejected", "audit_id": audit_id}


@router.get("/list")
async def list_tools():
    """返回所有可用工具列表（动态读取注册表）"""
    from engine.tool_registry import get_tool_registry
    registry = get_tool_registry()
    tools = []
    color_map = {
        "environment": "blue", "regulation": "purple", "report": "green",
        "analysis": "blue", "code": "orange", "shell": "red",
        "git": "cyan", "media": "green", "policy": "purple",
        "hermes": "orange", "general": "blue",
    }
    for tool in registry.get_all():
        entry = {
            "name": tool.name,
            "description": tool.description,
            "safety_level": f"L{tool.permission_level}",
            "color": color_map.get(tool.category, "blue"),
        }
        tools.append(entry)
    return {"tools": tools}


@router.get("/audit")
async def get_audit( limit: int = Query(default=100, le=500)):
    """查询审计日志"""
    return {"logs": get_audit_logs(limit)}
