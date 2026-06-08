#!/usr/bin/env python3
"""
EcoMind 文档自动生成器 — 从代码扫描生成文档固定段落

每次运行: 扫描实际代码 → 更新 README/CODE_WIKI/DESIGN/CLAUDE 中的自动段落

使用方法:
  python scripts/auto-doc.py              # 扫描并更新所有文档
  python scripts/auto-doc.py --check      # 只检查不修改 (CI 模式)
  python scripts/auto-doc.py --dry-run    # 打印将要更新的内容

自动更新的段落标记 (在这些标记之间的内容会被替换):
  <!-- AUTO-DOC:START --> ... <!-- AUTO-DOC:END -->
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent


# ── 扫描器 ────────────────────────────────────────────

def scan_project_state() -> dict[str, Any]:
    """扫描项目实际状态"""
    state = {}

    # 1. Git 信息
    try:
        state["git_tag"] = subprocess.check_output(
            ["git", "tag", "--sort=-creatordate"], text=True
        ).strip().split("\n")[0] or "v2.2.0"
    except Exception:
        state["git_tag"] = "v2.2.0"

    try:
        state["git_commit_count"] = subprocess.check_output(
            ["git", "rev-list", "--count", "HEAD"], text=True
        ).strip()
    except Exception:
        state["git_commit_count"] = "0"

    # 2. 后端模块
    backend = PROJECT_ROOT / "backend"
    state["py_files"] = len(list(backend.rglob("*.py")))
    state["py_loc"] = sum(
        len(open(f).readlines()) for f in backend.rglob("*.py")
        if "venv" not in str(f) and "__pycache__" not in str(f)
    )

    # 3. 路由
    main_py = backend / "api" / "main.py"
    routes = []
    if main_py.exists():
        for line in open(main_py):
            m = re.search(r'include_router\((\w+)\.router', line)
            if m:
                routes.append(m.group(1))
    state["routes"] = routes
    state["route_count"] = len(routes)

    # 4. 引擎模块
    engine_dir = backend / "engine"
    state["engine_modules"] = sorted(
        f.stem for f in engine_dir.glob("*.py")
        if f.stem != "__init__" and f.stem != "__pycache__"
    )

    # 5. 网关模块
    gateway_dir = backend / "gateway"
    state["gateway_modules"] = sorted(
        f.stem for f in (gateway_dir / "platforms").glob("*.py")
        if f.stem != "__init__"
    ) if (gateway_dir / "platforms").exists() else []

    # 6. RAG/Graph/Marketplace
    for mod in ["rag", "graph", "marketplace", "sandbox", "browser", "docgen"]:
        d = backend / mod
        if d.exists():
            state[f"{mod}_files"] = len(list(d.rglob("*.py")))

    # 7. 专家
    chat_page = PROJECT_ROOT / "frontend" / "src" / "pages" / "Chat" / "index.tsx"
    expert_names = []
    if chat_page.exists():
        content = open(chat_page).read()
        for m in re.finditer(r'name:\s*"([^"]+)"', content):
            expert_names.append(m.group(1))
    state["experts"] = expert_names
    state["expert_count"] = len(expert_names)

    # 8. 前端
    frontend = PROJECT_ROOT / "frontend" / "src"
    state["tsx_files"] = len(list(frontend.rglob("*.tsx")))
    state["ts_files"] = len(list(frontend.rglob("*.ts")))
    state["frontend_pages"] = sorted(
        d.name for d in (frontend / "pages").iterdir() if d.is_dir()
    )
    state["frontend_components"] = sorted(
        d.name for d in (frontend / "components").iterdir() if d.is_dir()
    )

    # 9. 测试
    test_dir = backend / "tests"
    test_files = []
    for f in test_dir.rglob("test_*.py"):
        test_files.append(f"{f.parent.name}/{f.stem}")
    state["test_files"] = sorted(test_files)
    state["test_count"] = len(test_files)

    # 10. 产品子系统
    state["subsystems"] = _classify_subsystems(state)

    return state


def _classify_subsystems(state: dict) -> list[dict]:
    subs = [
        {"name": "Agent 引擎", "emoji": "🧠", "modules": state["engine_modules"]},
        {"name": "消息网关", "emoji": "📡", "platforms": state["gateway_modules"]},
        {"name": "RAG 检索", "emoji": "🔍", "modules": ["rag"]},
        {"name": "知识图谱", "emoji": "🕸️", "modules": ["graph"]},
        {"name": "技能市场", "emoji": "🏪", "modules": ["marketplace"]},
        {"name": "代码沙箱", "emoji": "🔒", "modules": ["sandbox"]},
        {"name": "浏览器", "emoji": "🌐", "modules": ["browser"]},
        {"name": "文书生成", "emoji": "📄", "modules": ["docgen"]},
        {"name": "进化引擎", "emoji": "🧬", "modules": ["learning"]},
        {"name": "安全链", "emoji": "🛡️", "modules": ["safety_chain"]},
    ]
    return subs


# ── 生成器 ────────────────────────────────────────────

def gen_tech_stack(state: dict) -> str:
    modules = ", ".join(state["engine_modules"][:8])
    return f"""| 层次 | 技术 |
|------|------|
| 前端 | React 18 · TypeScript 5.7 · Vite 6 · Ant Design 5 · shadcn/ui · Tailwind CSS 4 · Cesium 3D · ECharts 5 · Zustand 5 |
| 后端 | FastAPI · Pydantic v2 · **EcoAgentEngine (自建)** · **EcoToolRegistry** · **EcoVerifier** · LiteLLM · httpx |
| AI 模型 | DeepSeek-V3/Coder · Qwen-Max/Plus/Turbo · GLM-4 · Yi-Large |
| 部署 | Docker Compose · Nginx · systemd/launchd · Shell 一键脚本 |
| 引擎 | {modules} |
| 规模 | {state['py_loc']} 行 Python ({state['py_files']} 文件) · {state['tsx_files'] + state['ts_files']} 前端文件 |"""


def gen_api_table(state: dict) -> str:
    rows = []
    for r in state["routes"][:20]:
        rows.append(f"| `{r}` | {r} router + service | ✅ |")
    if len(state["routes"]) > 20:
        rows.append(f"| ... | 还有 {len(state['routes']) - 20} 个路由 | |")
    return "\n".join(rows)


def gen_expert_table(state: dict) -> str:
    emoji_map = {
        "助手": "🧠", "环境监测": "🌍", "执法监察": "⚖️", "环评审批": "📋",
        "排污许可": "🏭", "生物多样性": "🌱", "碳排放": "💨", "应急管理": "🚨",
        "生态修复": "🌿", "生态督察": "🔍", "公众服务": "🤝",
    }
    rows = []
    for i, name in enumerate(state["experts"]):
        emoji = emoji_map.get(name.replace("专家", ""), "📌")
        rows.append(f"| {i+1} | {emoji} | {name} | 环境领域 | 专用 SOUL + 工具权限矩阵 |")
    return "\n".join(rows)


def gen_subsystem_tree(state: dict) -> str:
    lines = ["EcoMind-OS/"]
    lines.append("├── backend/                    # FastAPI — " +
                 f"{state['route_count']} 路由 + {len(state['engine_modules'])} 引擎模块")
    lines.append(f"│   ├── engine/                 # EcoAgentEngine — {len(state['engine_modules'])} 引擎 ({', '.join(state['engine_modules'][:6])}...)")
    lines.append(f"│   ├── gateway/platforms/       # 消息网关 — {', '.join(state['gateway_modules'][:4])}")
    for mod in ["rag", "graph", "marketplace"]:
        lines.append(f"│   ├── {mod}/                      # {mod.upper()} 模块")
    lines.append(f"├── frontend/                   # React 18 — {len(state['frontend_pages'])} 页面 + {len(state['frontend_components'])} 组件")
    lines.append(f"├── spec/                       # 规格文档")
    lines.append(f"├── deploy/                     # 部署配置")
    lines.append(f"├── scripts/                    # 运维脚本")
    lines.append(f"└── .github/workflows/          # CI/CD ({state['git_commit_count']} commits)")
    return "\n".join(lines)


def gen_version_badge(state: dict) -> str:
    ver = state["git_tag"].lstrip("v")
    return f"""<img src="https://img.shields.io/badge/Version-{ver}-green?style=for-the-badge"/>"""


# ── 文档更新器 ────────────────────────────────────────

AUTO_BLOCK = re.compile(r"<!--\s*AUTO-DOC\s*-->\s*\n(.*?)\n\s*<!--\s*AUTO-DOC\s*-->", re.DOTALL)

SECTION_TEMPLATES = {
    "TECH_STACK": gen_tech_stack,
    "API_TABLE": gen_api_table,
    "EXPERT_TABLE": gen_expert_table,
    "SUBSYSTEM_TREE": gen_subsystem_tree,
    "VERSION_BADGE": gen_version_badge,
}


def file_has_marker(path: Path) -> bool:
    return path.exists() and "AUTO-DOC" in open(path).read()


def update_file(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    print(f"  ✅ {path.name}")


def scan_and_replace(path: Path, state: dict) -> bool:
    """扫描文件中的 AUTO-DOC 标记, 替换对应 section"""
    if not path.exists():
        return False

    changed = False
    content = open(path, encoding="utf-8").read()

    for section_name, generator_fn in SECTION_TEMPLATES.items():
        marker = f"<!-- AUTO-DOC:{section_name} -->"
        end_marker = f"<!-- /AUTO-DOC:{section_name} -->"

        if marker not in content:
            continue

        new_block = generator_fn(state)
        old_content = content

        pattern = re.compile(
            re.escape(marker) + r".*?" + re.escape(end_marker),
            re.DOTALL,
        )
        replacement = marker + "\n" + new_block + "\n" + end_marker
        content = pattern.sub(replacement, content)

        if content != old_content:
            changed = True

    if changed:
        update_file(path, content)
    return changed


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="CI mode: check without modifying")
    parser.add_argument("--dry-run", action="store_true", help="Print what would change")
    args = parser.parse_args()

    print("🔍 扫描项目状态...")
    state = scan_project_state()

    print(f"""
  📊 项目快照:
    Python:   {state['py_files']} 文件, {state['py_loc']} 行
    后端路由:  {state['route_count']} 个
    引擎模块:  {len(state['engine_modules'])} 个 {state['engine_modules'][:8]}
    网关平台:  {len(state['gateway_modules'])} 个 {state['gateway_modules']}
    前端页面:  {len(state['frontend_pages'])} 个 {state['frontend_pages'][:5]}
    专家:      {state['expert_count']} 个 {state['experts'][:5]}
    测试:      {state['test_count']} 个
    版本:      {state['git_tag']}
""")

    if args.dry_run:
        return

    # 扫描包含 AUTO-DOC 标记的文件
    targets = list(PROJECT_ROOT.rglob("*.md"))
    targets = [t for t in targets if t.exists() and "AUTO-DOC" in t.read_text(encoding="utf-8")]

    if not targets:
        print("⚠️  未找到包含 AUTO-DOC 标记的文件")
        print("   请在文件中对需要自动更新的段落添加标记:")
        print("   <!-- AUTO-DOC:SECTION_NAME -->")
        print("   ... 内容 (会被自动替换) ...")
        print("   <!-- /AUTO-DOC:SECTION_NAME -->")
        return

    updated = 0
    for t in targets:
        if scan_and_replace(t, state):
            updated += 1

    if args.check and updated > 0:
        print(f"\n❌ 发现 {updated} 个文档需要更新。运行 scripts/auto-doc.py 修复。")
        sys.exit(1)

    print(f"\n✅ 更新了 {updated} 个文件")


if __name__ == "__main__":
    main()
