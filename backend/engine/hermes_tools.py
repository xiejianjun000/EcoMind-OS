"""
EcoMind Hermes 能力扩展工具集

为 EcoMind 注入 Hermes 级的自主执行能力：
- 无限制 Shell 执行
- 真实文件写入/编辑
- 通用网页搜索与抓取
- 消息通道（飞书）
- 部署管理
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

# ─── 安全边界 ───────────────────────────────────────
ALLOWED_WRITE_DIRS = [
    str(PROJECT_ROOT),
    "/tmp",
    os.path.expanduser("~/taiji-workspace"),
    os.path.expanduser("~/Documents"),
]

def _is_safe_path(path: str) -> bool:
    """检查路径是否在允许的写入目录内"""
    abs_path = os.path.abspath(os.path.expanduser(path))
    for allowed in ALLOWED_WRITE_DIRS:
        if abs_path.startswith(os.path.abspath(os.path.expanduser(allowed))):
            return True
    return False


# ─── 1. 终端执行 ───────────────────────────────────
async def terminal_exec(command: str, timeout: int = 60, workdir: str = "") -> dict:
    """执行 Shell 命令并返回输出"""
    cwd = os.path.expanduser(workdir) if workdir else str(PROJECT_ROOT)
    if not os.path.isdir(cwd):
        cwd = str(PROJECT_ROOT)

    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=timeout
        )
        return {
            "exit_code": proc.returncode or 0,
            "stdout": stdout.decode("utf-8", errors="replace")[:10000],
            "stderr": stderr.decode("utf-8", errors="replace")[:5000],
        }
    except asyncio.TimeoutError:
        return {"exit_code": -1, "stdout": "", "stderr": f"命令超时 ({timeout}s)"}
    except Exception as e:
        return {"exit_code": -1, "stdout": "", "stderr": str(e)}


# ─── 2. 文件写入 ───────────────────────────────────
async def file_write(path: str, content: str) -> dict:
    """写入文件内容（覆盖）"""
    abs_path = os.path.abspath(os.path.expanduser(path))
    if not _is_safe_path(abs_path):
        return {"success": False, "error": f"路径不在允许范围内: {abs_path}"}

    try:
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(content)
        return {
            "success": True,
            "path": abs_path,
            "size": len(content),
            "lines": content.count("\n") + 1,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── 3. 文件编辑（patch） ──────────────────────────
async def file_patch(path: str, old_string: str, new_string: str) -> dict:
    """在文件中查找并替换文本"""
    abs_path = os.path.abspath(os.path.expanduser(path))
    if not _is_safe_path(abs_path):
        return {"success": False, "error": f"路径不在允许范围内: {abs_path}"}
    if not os.path.isfile(abs_path):
        return {"success": False, "error": f"文件不存在: {abs_path}"}

    try:
        with open(abs_path, "r", encoding="utf-8") as f:
            content = f.read()

        if old_string not in content:
            return {"success": False, "error": "未找到目标文本"}

        new_content = content.replace(old_string, new_string, 1)
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(new_content)

        return {
            "success": True,
            "path": abs_path,
            "replaced": True,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── 4. 网页搜索 ───────────────────────────────────
async def web_search(query: str, max_results: int = 5) -> dict:
    """通用网页搜索"""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15.0) as client:
            # 使用 DuckDuckGo HTML 搜索（无需 API key）
            r = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={"User-Agent": "EcoMind/1.0"},
            )
            # 简单提取结果
            results = []
            text = r.text
            # 简单解析搜索结果
            import re
            snippets = re.findall(
                r'<a[^>]*class="result__a"[^>]*>(.*?)</a>.*?<a[^>]*class="result__snippet"[^>]*>(.*?)</a>',
                text,
                re.DOTALL,
            )
            for title, snippet in snippets[:max_results]:
                results.append({
                    "title": re.sub(r"<[^>]+>", "", title).strip(),
                    "snippet": re.sub(r"<[^>]+>", "", snippet).strip(),
                })

            return {"results": results, "count": len(results)}
    except Exception as e:
        return {"results": [], "error": str(e)}


# ─── 5. 网页抓取 ───────────────────────────────────
async def web_fetch(url: str) -> dict:
    """抓取网页内容"""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            r = await client.get(
                url,
                headers={"User-Agent": "EcoMind/1.0"},
            )
            # 提取文本内容
            text = r.text
            # 简单去标签
            import re
            text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL)
            text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
            text = re.sub(r"<[^>]+>", " ", text)
            text = re.sub(r"\s+", " ", text).strip()

            return {
                "url": str(r.url),
                "status": r.status_code,
                "content": text[:10000],
                "content_type": r.headers.get("content-type", ""),
            }
    except Exception as e:
        return {"error": str(e)}


# ─── 6. 飞书消息发送 ───────────────────────────────
async def feishu_send(message: str, target: str = "home") -> dict:
    """通过飞书发送消息"""
    import shutil
    lark_cli = shutil.which("lark-cli") or shutil.which("lark")
    if not lark_cli:
        # 尝试通过 Hermes send_message
        return {"success": False, "error": "lark-cli 未安装"}

    try:
        proc = await asyncio.create_subprocess_exec(
            lark_cli, "im", "send", "--text", message,
            "--as", "bot",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        return {
            "success": proc.returncode == 0,
            "output": stdout.decode("utf-8", errors="replace")[:500],
            "error": stderr.decode("utf-8", errors="replace")[:500] if proc.returncode != 0 else "",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── 7. 文件读取 ───────────────────────────────────
async def file_read(path: str, offset: int = 1, limit: int = 500) -> dict:
    """读取文件内容"""
    abs_path = os.path.abspath(os.path.expanduser(path))
    if not os.path.isfile(abs_path):
        return {"error": f"文件不存在: {abs_path}"}

    try:
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()

        start = max(0, offset - 1)
        end = min(len(lines), start + limit)
        selected = lines[start:end]

        return {
            "path": abs_path,
            "content": "".join(selected),
            "total_lines": len(lines),
            "shown_lines": len(selected),
            "offset": offset,
        }
    except Exception as e:
        return {"error": str(e)}


# ─── 8. 文件搜索 ───────────────────────────────────
async def file_search(pattern: str, path: str = ".", file_glob: str = "*") -> dict:
    """搜索文件内容"""
    import glob as _glob
    import re

    search_dir = os.path.abspath(os.path.expanduser(path))
    if not os.path.isdir(search_dir):
        search_dir = str(PROJECT_ROOT)

    results = []
    try:
        for filepath in _glob.glob(
            os.path.join(search_dir, "**", file_glob), recursive=True
        ):
            if not os.path.isfile(filepath):
                continue
            if os.path.getsize(filepath) > 500_000:
                continue
            try:
                with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                    for i, line in enumerate(f, 1):
                        if re.search(pattern, line):
                            results.append({
                                "file": os.path.relpath(filepath, search_dir),
                                "line": i,
                                "content": line.strip()[:200],
                            })
                            if len(results) >= 50:
                                break
                if len(results) >= 50:
                    break
            except Exception:
                continue
    except Exception as e:
        return {"matches": [], "error": str(e)}

    return {"matches": results, "count": len(results)}


# ─── 9. 记忆存储 ───────────────────────────────────
async def memory_save_handler(content: str, category: str = "general", tags: str = "") -> dict:
    """保存记忆到持久化存储"""
    from engine.hermes_memory import HermesMemory
    mid = HermesMemory.save(content=content, category=category, tags=tags)
    return {"memory_id": mid, "status": "saved"}


async def memory_search_handler(query: str, limit: int = 10) -> dict:
    """搜索历史记忆"""
    from engine.hermes_memory import HermesMemory
    results = HermesMemory.search(query=query, limit=limit)
    return {"results": results, "count": len(results)}


async def fact_add_handler(entity: str, fact: str, category: str = "general") -> dict:
    """添加结构化事实"""
    from engine.hermes_memory import HermesMemory
    fid = HermesMemory.add_fact(entity=entity, fact=fact, category=category)
    return {"fact_id": fid, "status": "added"}


async def fact_probe_handler(entity: str) -> dict:
    """查询实体事实"""
    from engine.hermes_memory import HermesMemory
    facts = HermesMemory.probe(entity=entity)
    return {"entity": entity, "facts": facts, "count": len(facts)}


async def memory_stats_handler() -> dict:
    """记忆统计"""
    from engine.hermes_memory import HermesMemory
    return HermesMemory.stats()


# ─── 10. 技能生成 ──────────────────────────────────
async def skill_create_handler(
    skill_name: str = "",
    display_name: str = "",
    category: str = "general",
    steps_text: str = "",
) -> dict:
    """手动创建技能（自动技能由 AutoSkillEngine 在后台生成）"""
    name = skill_name
    if not name or not display_name:
        return {"error": "name 和 display_name 必填"}

    from engine.auto_skill import AutoSkill, SKILLS_DIR
    import time

    skill = AutoSkill(
        id=name,
        name=name,
        display_name=display_name,
        description=f"手动创建: {display_name}",
        category=category,
        author="ecomind",
        author_name="EcoMind主控",
        triggers=[],
        tools_used=[],
        steps=[s.strip() for s in steps_text.split("\n") if s.strip()] if steps_text else [],
        source_conversation="手动创建",
        created_at=time.time(),
    )

    filepath = SKILLS_DIR / f"{name}.md"
    filepath.write_text(skill.to_markdown(), encoding="utf-8")

    from engine.auto_skill import get_auto_skill_engine
    engine = get_auto_skill_engine()
    engine._skills[skill.id] = skill

    return {"skill_id": skill.id, "display_name": skill.display_name, "status": "created"}


# ─── 注册所有工具 ──────────────────────────────────
def register_hermes_tools(registry):
    """向工具注册表注入 Hermes 级能力"""
    from engine.tool_registry import EcoTool

    tools = [
        EcoTool(
            name="terminal",
            description="执行 Shell 命令并返回输出（无限制执行，替代预览模式的 shell_exec）",
            handler=terminal_exec,
            permission_level=2,
            category="hermes",
            parameters={
                "command": {"type": "string", "description": "要执行的 Shell 命令"},
                "timeout": {"type": "integer", "description": "超时秒数，默认 60"},
                "workdir": {"type": "string", "description": "工作目录，默认项目根"},
            },
        ),
        EcoTool(
            name="write_file",
            description="写入文件内容（真实写入，非预览）",
            handler=file_write,
            permission_level=2,
            category="hermes",
            parameters={
                "path": {"type": "string", "description": "文件路径"},
                "content": {"type": "string", "description": "文件内容"},
            },
        ),
        EcoTool(
            name="patch_file",
            description="在文件中查找并替换文本",
            handler=file_patch,
            permission_level=2,
            category="hermes",
            parameters={
                "path": {"type": "string", "description": "文件路径"},
                "old_string": {"type": "string", "description": "要查找的文本"},
                "new_string": {"type": "string", "description": "替换后的文本"},
            },
        ),
        EcoTool(
            name="read_file",
            description="读取文件内容（带行号）",
            handler=file_read,
            permission_level=1,
            category="hermes",
            parameters={
                "path": {"type": "string", "description": "文件路径"},
                "offset": {"type": "integer", "description": "起始行号，默认 1"},
                "limit": {"type": "integer", "description": "最大行数，默认 500"},
            },
        ),
        EcoTool(
            name="search_files",
            description="在文件中搜索匹配的文本模式",
            handler=file_search,
            permission_level=1,
            category="hermes",
            parameters={
                "pattern": {"type": "string", "description": "正则表达式搜索模式"},
                "path": {"type": "string", "description": "搜索目录，默认项目根"},
                "file_glob": {"type": "string", "description": "文件过滤 glob，默认 *"},
            },
        ),
        EcoTool(
            name="web_search",
            description="通用网页搜索（DuckDuckGo）",
            handler=web_search,
            permission_level=1,
            category="hermes",
            parameters={
                "query": {"type": "string", "description": "搜索关键词"},
                "max_results": {"type": "integer", "description": "最大结果数，默认 5"},
            },
        ),
        EcoTool(
            name="web_fetch",
            description="抓取网页内容并提取文本",
            handler=web_fetch,
            permission_level=1,
            category="hermes",
            parameters={
                "url": {"type": "string", "description": "要抓取的网页 URL"},
            },
        ),
        EcoTool(
            name="send_message",
            description="通过飞书发送消息",
            handler=feishu_send,
            permission_level=2,
            category="hermes",
            parameters={
                "message": {"type": "string", "description": "消息文本"},
                "target": {"type": "string", "description": "发送目标，默认 home"},
            },
        ),
        # ─── Hermes 记忆工具 ───
        EcoTool(
            name="memory_save",
            description="保存一条记忆到持久化存储（跨会话保留）。用于记住用户偏好、重要事实、经验教训。",
            handler=memory_save_handler,
            permission_level=1,
            category="hermes",
            parameters={
                "content": {"type": "string", "description": "记忆内容"},
                "category": {"type": "string", "description": "分类: user_pref/project/tool/general"},
                "tags": {"type": "string", "description": "标签，逗号分隔"},
            },
        ),
        EcoTool(
            name="memory_search",
            description="全文搜索历史记忆。用于回顾之前保存的知识和经验。",
            handler=memory_search_handler,
            permission_level=1,
            category="hermes",
            parameters={
                "query": {"type": "string", "description": "搜索关键词"},
                "limit": {"type": "integer", "description": "最多返回条数，默认10"},
            },
        ),
        EcoTool(
            name="fact_add",
            description="添加结构化事实（实体-事实对）。用于记录关于特定实体的事实信息。",
            handler=fact_add_handler,
            permission_level=1,
            category="hermes",
            parameters={
                "entity": {"type": "string", "description": "实体名称（如 碳排放专家、湘江）"},
                "fact": {"type": "string", "description": "关于该实体的事实"},
                "category": {"type": "string", "description": "分类"},
            },
        ),
        EcoTool(
            name="fact_probe",
            description="查询某实体的所有已知事实。用于了解特定对象的历史信息。",
            handler=fact_probe_handler,
            permission_level=1,
            category="hermes",
            parameters={
                "entity": {"type": "string", "description": "实体名称"},
            },
        ),
        EcoTool(
            name="memory_stats",
            description="查看记忆系统统计信息（总记忆数、事实数等）",
            handler=memory_stats_handler,
            permission_level=1,
            category="hermes",
            parameters={},
        ),
        EcoTool(
            name="skill_create",
            description="创建一个新技能并注册到技能广场。将专家经验沉淀为可复用技能。",
            handler=skill_create_handler,
            permission_level=2,
            category="hermes",
            parameters={
                "skill_name": {"type": "string", "description": "技能英文标识（如 cod-case-workflow）"},
                "display_name": {"type": "string", "description": "技能中文名（如 COD超标案件处理流程）"},
                "category": {"type": "string", "description": "分类: enforcement/eia/carbon/water/..."},
                "steps_text": {"type": "string", "description": "操作步骤，每行一个步骤"},
            },
        ),
    ]

    for tool in tools:
        registry.register(tool)

    logger.info(f"已注册 {len(tools)} 个 Hermes 级工具")
    return len(tools)
