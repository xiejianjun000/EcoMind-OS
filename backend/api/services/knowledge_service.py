"""
本地资料库服务 — 扫描本地目录，自动分类文件
"""
from __future__ import annotations

import os
import logging
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# 默认扫描目录（可通过环境变量配置）
DEFAULT_SCAN_DIRS = [
    os.path.expanduser("~/Documents"),
    os.path.expanduser("~/Desktop"),
]

# 支持的文件类型
SUPPORTED_EXTENSIONS = {
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm',
    '.png', '.jpg', '.jpeg', '.gif', '.bmp',
}

# 文件分类规则
CATEGORY_RULES = [
    {
        'id': 'regulations',
        'name': '法规标准',
        'icon': '📕',
        'keywords': ['法', '条例', '标准', '规范', '办法', '规定', '通知', '公告', '令'],
        'extensions': {'.pdf', '.doc', '.docx', '.txt', '.md'},
    },
    {
        'id': 'cases',
        'name': '案例资料',
        'icon': '📗',
        'keywords': ['案例', '项目', '环评', '监测', '执法', '督察', '整改', '批复'],
        'extensions': {'.pdf', '.doc', '.docx'},
    },
    {
        'id': 'data',
        'name': '监测数据',
        'icon': '📘',
        'keywords': ['数据', '监测', 'AQI', 'PM', '水质', '统计', '报表', '台账'],
        'extensions': {'.csv', '.xlsx', '.xls', '.json', '.xml'},
    },
    {
        'id': 'reports',
        'name': '报告文档',
        'icon': '📙',
        'keywords': ['报告', '总结', '分析', '评估', '方案', '规划', '计划'],
        'extensions': {'.pdf', '.doc', '.docx', '.pptx', '.ppt'},
    },
]


def classify_file(filepath: str) -> str:
    """根据文件名和扩展名自动分类"""
    name = os.path.basename(filepath).lower()
    ext = os.path.splitext(filepath)[1].lower()

    for cat in CATEGORY_RULES:
        if ext not in cat['extensions']:
            continue
        for kw in cat['keywords']:
            if kw.lower() in name:
                return cat['id']

    # 按扩展名回退分类
    if ext in {'.csv', '.xlsx', '.xls', '.json', '.xml'}:
        return 'data'
    if ext in {'.pdf', '.doc', '.docx'}:
        return 'reports'
    if ext in {'.pptx', '.ppt'}:
        return 'reports'

    return 'other'


def get_category_info(cat_id: str) -> dict:
    for cat in CATEGORY_RULES:
        if cat['id'] == cat_id:
            return cat
    return {'id': 'other', 'name': '其他文件', 'icon': '📓', 'keywords': [], 'extensions': set()}


def scan_directory(directory: str, max_files: int = 500) -> list[dict]:
    """扫描目录，返回分类后的文件列表"""
    files = []
    seen = set()

    try:
        for root, dirs, filenames in os.walk(directory):
            # 跳过隐藏目录和常见忽略目录
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in
                       {'node_modules', '__pycache__', '.git', 'venv', '.venv', 'dist', 'build'}]

            for fname in filenames:
                if fname.startswith('.') or fname.startswith('~'):
                    continue
                ext = os.path.splitext(fname)[1].lower()
                if ext not in SUPPORTED_EXTENSIONS:
                    continue

                full_path = os.path.join(root, fname)
                try:
                    stat = os.stat(full_path)
                    size = stat.st_size
                except OSError:
                    continue

                # 去重（同名文件取最新的）
                key = fname.lower()
                if key in seen:
                    continue
                seen.add(key)

                category = classify_file(fname)
                cat_info = get_category_info(category)

                files.append({
                    'name': fname,
                    'path': full_path,
                    'size': size,
                    'size_display': _format_size(size),
                    'extension': ext,
                    'category': category,
                    'category_name': cat_info['name'],
                    'icon': cat_info['icon'],
                    'modified': _format_time(stat.st_mtime),
                })

                if len(files) >= max_files:
                    return files
    except PermissionError:
        logger.warning(f"无权限访问目录: {directory}")
    except Exception as e:
        logger.error(f"扫描目录出错 {directory}: {e}")

    return files


def scan_all(scanned_dirs: list[str] = None) -> dict:
    """扫描所有配置目录，按分类整理"""
    if scanned_dirs is None:
        scanned_dirs = os.getenv('KNOWLEDGE_SCAN_DIRS', '').split(',') if os.getenv('KNOWLEDGE_SCAN_DIRS') else DEFAULT_SCAN_DIRS
    # 过滤空值和不存在的目录
    scanned_dirs = [d.strip() for d in scanned_dirs if d and d.strip() and os.path.isdir(d.strip())]

    all_files = []
    for d in scanned_dirs:
        logger.info(f"扫描目录: {d}")
        all_files.extend(scan_directory(d))

    # 按分类分组
    categories = {}
    for f in all_files:
        cat = f['category']
        if cat not in categories:
            cat_info = get_category_info(cat)
            categories[cat] = {
                'id': cat,
                'name': cat_info['name'],
                'icon': cat_info['icon'],
                'files': [],
                'count': 0,
            }
        categories[cat]['files'].append(f)
        categories[cat]['count'] += 1

    # 按文件数量排序
    sorted_cats = sorted(categories.values(), key=lambda c: c['count'], reverse=True)

    return {
        'scanned_dirs': scanned_dirs,
        'total_files': len(all_files),
        'categories': sorted_cats,
    }


def _format_size(size: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def _format_time(timestamp: float) -> str:
    from datetime import datetime
    dt = datetime.fromtimestamp(timestamp)
    now = datetime.now()
    diff = now - dt
    if diff.days == 0:
        return f"今天 {dt.strftime('%H:%M')}"
    elif diff.days == 1:
        return f"昨天 {dt.strftime('%H:%M')}"
    elif diff.days < 7:
        return f"{diff.days}天前"
    else:
        return dt.strftime('%Y-%m-%d')


# ─── 文件内容读取 ───

# 可安全读取的文本文件扩展名
TEXT_EXTENSIONS = {'.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm', '.py', '.js', '.ts', '.tsx', '.jsx', '.css', '.yaml', '.yml', '.log', '.env', '.gitignore'}

MAX_READ_SIZE = 50 * 1024  # 最大读取 50KB（避免 token 爆炸）


def read_file_content(filepath: str, max_size: int = MAX_READ_SIZE) -> dict:
    """读取文件内容（仅文本文件）"""
    ext = os.path.splitext(filepath)[1].lower()
    fname = os.path.basename(filepath)

    # 检查文件是否存在
    if not os.path.isfile(filepath):
        return {"error": "文件不存在", "path": filepath}

    # 检查大小
    try:
        size = os.path.getsize(filepath)
    except OSError:
        return {"error": "无法读取文件信息", "path": filepath}

    if size > 10 * 1024 * 1024:  # 超过 10MB 不读
        return {
            "name": fname,
            "path": filepath,
            "size": size,
            "size_display": _format_size(size),
            "extension": ext,
            "readable": False,
            "reason": f"文件过大 ({_format_size(size)})，不支持在线阅读",
        }

    # 文本文件：直接读取
    if ext in TEXT_EXTENSIONS:
        try:
            with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read(max_size)
            truncated = len(content) >= max_size
            return {
                "name": fname,
                "path": filepath,
                "size": size,
                "size_display": _format_size(size),
                "extension": ext,
                "readable": True,
                "content": content,
                "truncated": truncated,
            }
        except Exception as e:
            return {"error": f"读取失败: {e}", "path": filepath}

    # PDF 文件：尝试提取文本
    if ext == '.pdf':
        try:
            import subprocess
            result = subprocess.run(
                ['pdftotext', '-l', '5', filepath, '-'],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0 and result.stdout.strip():
                content = result.stdout[:max_size]
                return {
                    "name": fname,
                    "path": filepath,
                    "size": size,
                    "size_display": _format_size(size),
                    "extension": ext,
                    "readable": True,
                    "content": content,
                    "truncated": len(content) >= max_size,
                    "note": "已提取 PDF 前 5 页文本",
                }
        except Exception:
            pass
        return {
            "name": fname,
            "path": filepath,
            "size": size,
            "size_display": _format_size(size),
            "extension": ext,
            "readable": False,
            "reason": "PDF 文件需要安装 pdftotext 工具才能提取文本",
        }

    # Office 文档：无法直接读取
    if ext in {'.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'}:
        return {
            "name": fname,
            "path": filepath,
            "size": size,
            "size_display": _format_size(size),
            "extension": ext,
            "readable": False,
            "reason": f"Office 文档（{ext}）暂不支持在线预览，请下载后查看",
        }

    # 其他文件
    return {
        "name": fname,
        "path": filepath,
        "size": size,
        "size_display": _format_size(size),
        "extension": ext,
        "readable": False,
        "reason": f"不支持的文件类型 ({ext})",
    }


def search_files(query: str, scanned_dirs: list[str] = None) -> list[dict]:
    """按关键词搜索资料库文件"""
    if not query or len(query.strip()) < 2:
        return []

    keywords = query.lower().split()
    result = scan_all(scanned_dirs)
    matches = []

    for cat in result.get('categories', []):
        for f in cat['files']:
            name_lower = f['name'].lower()
            score = sum(1 for kw in keywords if kw in name_lower)
            if score > 0:
                matches.append({
                    **f,
                    'score': score,
                    'match_category': cat['name'],
                })

    # 按匹配分数排序
    matches.sort(key=lambda x: x['score'], reverse=True)
    return matches[:20]  # 最多返回 20 个结果


async def search_knowledge(query: str, top_k: int = 5, category: str = "all") -> list[dict]:
    """
    搜索本地知识库 — 供 engine/tool_registry 调用。

    返回格式化的结果列表，每条包含 title、match、source 字段。
    先搜索本地文件，再回退到内置知识条目。
    """
    if not query or len(query.strip()) < 2:
        return []

    results: list[dict] = []

    # 1. 搜索本地资料库文件
    try:
        file_matches = search_files(query)
        for f in file_matches[:top_k]:
            results.append({
                "title": f["name"],
                "match": f"匹配关键词（评分: {f.get('score', 0)}），分类: {f.get('match_category', '未知')}",
                "source": f"本地资料库: {f['path']}",
                "type": "local_file",
                "category": f.get("match_category", "unknown"),
            })
    except Exception as e:
        logger.warning(f"本地文件搜索失败: {e}")

    # 2. 如果本地结果不足，补充内置知识条目
    if len(results) < top_k:
        builtin = _search_builtin_knowledge(query, top_k - len(results), category)
        results.extend(builtin)

    return results[:top_k]


def _search_builtin_knowledge(query: str, limit: int = 3, category: str = "all") -> list[dict]:
    """
    搜索内置知识库 — 中国生态环境核心法规数据库。

    当本地资料库无法满足搜索需求时的回退方案。
    """
    BUILTIN_KNOWLEDGE: list[dict] = [
        {
            "title": "《中华人民共和国环境保护法》",
            "keywords": ["环境", "保护", "污染", "生态", "违法", "处罚", "监测", "排污"],
            "articles": {
                "第6条": "一切单位和个人都有保护环境的义务。地方各级人民政府应当对本行政区域的环境质量负责。",
                "第42条": "排放污染物的企业事业单位和其他生产经营者，应当采取措施，防治在生产建设或者其他活动中产生的废气、废水、废渣、医疗废物、粉尘、恶臭气体、放射性物质以及噪声、振动、光辐射、电磁辐射等对环境的污染和危害。",
                "第59条": "企业事业单位和其他生产经营者违法排放污染物，受到罚款处罚，被责令改正，拒不改正的，依法作出处罚决定的行政机关可以自责令改正之日的次日起，按照原处罚数额按日连续处罚。",
                "第63条": "企业事业单位和其他生产经营者有下列行为之一，尚不构成犯罪的，除依照有关法律法规规定予以处罚外，由县级以上人民政府环境保护主管部门或者其他有关部门将案件移送公安机关...",
            },
        },
        {
            "title": "《中华人民共和国大气污染防治法》",
            "keywords": ["大气", "空气", "废气", "PM2.5", "PM10", "臭氧", "VOCs", "扬尘", "机动车", "燃煤"],
            "articles": {
                "第99条": "违反本法规定，有下列行为之一的，由县级以上人民政府生态环境主管部门责令改正或者限制生产、停产整治，并处十万元以上一百万元以下的罚款；情节严重的，报经有批准权的人民政府批准，责令停业、关闭：（一）未依法取得排污许可证排放大气污染物的；（二）超过大气污染物排放标准或者超过重点大气污染物排放总量控制指标排放大气污染物的...",
                "第18条": "企业事业单位和其他生产经营者建设对大气环境有影响的项目，应当依法进行环境影响评价、公开环境影响评价文件；向大气排放污染物的，应当符合大气污染物排放标准，遵守重点大气污染物排放总量控制要求。",
            },
        },
        {
            "title": "《中华人民共和国水污染防治法》",
            "keywords": ["水", "水质", "污水", "废水", "饮用水", "地下水", "流域", "COD", "氨氮", "总磷"],
            "articles": {
                "第83条": "违反本法规定，有下列行为之一的，由县级以上人民政府环境保护主管部门责令改正或者责令限制生产、停产整治，并处十万元以上一百万元以下的罚款...",
                "第10条": "排放水污染物，不得超过国家或者地方规定的水污染物排放标准和重点水污染物排放总量控制指标。",
            },
        },
        {
            "title": "《碳排放权交易管理办法（试行）》",
            "keywords": ["碳", "排放", "配额", "交易", "CCER", "碳达峰", "碳中和", "温室气体", "核查"],
            "articles": {
                "第25条": "重点排放单位应当在生态环境部规定的时限内，向分配配额的省级生态环境主管部门清缴上年度的碳排放配额。清缴量应当大于等于省级生态环境主管部门核查结果确认的该单位上年度温室气体实际排放量。",
                "第29条": "重点排放单位每年可以使用国家核证自愿减排量抵销碳排放配额的清缴，抵销比例不得超过应清缴碳排放配额的5%。",
            },
        },
        {
            "title": "《环境影响评价法》",
            "keywords": ["环评", "评价", "审批", "建设", "项目", "分类管理", "报告书", "报告表"],
            "articles": {
                "第16条": "国家根据建设项目对环境的影响程度，对建设项目的环境影响评价实行分类管理。建设单位应当按照规定分别组织编制环境影响报告书、环境影响报告表或者填报环境影响登记表。",
                "第31条": "建设单位未依法报批建设项目环境影响报告书、报告表，擅自开工建设的，由县级以上生态环境主管部门责令停止建设，根据违法情节和危害后果，处建设项目总投资额百分之一以上百分之五以下的罚款...",
            },
        },
        {
            "title": "《固体废物污染环境防治法》",
            "keywords": ["固废", "危废", "垃圾", "填埋", "焚烧", "回收", "医疗废物", "塑料"],
            "articles": {
                "第102条": "违反本法规定，有下列行为之一，由生态环境主管部门责令改正，处以罚款，没收违法所得；情节严重的，报经有批准权的人民政府批准，可以责令停业或者关闭...",
            },
        },
        {
            "title": "《土壤污染防治法》",
            "keywords": ["土壤", "重金属", "修复", "地块", "调查", "风险评估", "管控"],
            "articles": {
                "第87条": "违反本法规定，土壤污染责任人或者土地使用权人未按照规定进行土壤污染状况调查、风险评估、风险管控、修复的，由地方人民政府生态环境主管部门或者其他负有土壤污染防治监督管理职责的部门责令改正，处二万元以上二十万元以下的罚款...",
            },
        },
        {
            "title": "《噪声污染防治法》",
            "keywords": ["噪声", "噪音", "扰民", "施工", "交通", "工业噪声"],
            "articles": {
                "第71条": "违反本法规定，在噪声敏感建筑物集中区域新建排放噪声的工业企业的，由生态环境主管部门责令停止违法行为，处十万元以上五十万元以下的罚款...",
            },
        },
    ]

    if not query:
        return []

    query_lower = query.lower()
    scored: list[tuple[int, dict]] = []

    for item in BUILTIN_KNOWLEDGE:
        if category != "all" and category not in item.get("category", ""):
            continue

        # 计算标题匹配分数
        title_score = 3 if any(kw in item["title"] for kw in query_lower.split()) else 0
        # 计算关键词匹配分数
        kw_score = sum(1 for kw in item["keywords"] if kw in query_lower)
        total_score = title_score + kw_score

        if total_score <= 0:
            continue

        # 找到最匹配的条款
        best_article_key = ""
        best_article_text = ""
        for key, text in item["articles"].items():
            if any(kw in query_lower for kw in key.split()) or any(kw in query_lower for kw in text.split()):
                best_article_key = key
                best_article_text = text
                break

        if not best_article_key:
            # 返回第一条作为默认
            first_key = next(iter(item["articles"].keys()))
            best_article_key = first_key
            best_article_text = item["articles"][first_key]

        scored.append((
            total_score,
            {
                "title": item["title"],
                "match": f"{best_article_key} — {best_article_text[:120]}...",
                "source": "内置法规库",
                "type": "builtin",
                "category": "regulations",
                "score": total_score,
            },
        ))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:limit]]


def get_knowledge_summary(scanned_dirs: list[str] = None) -> str:
    """生成资料库摘要文本（注入 system prompt）"""
    result = scan_all(scanned_dirs)
    if result['total_files'] == 0:
        return ""

    lines = ["【本地资料库摘要 — 以下文件可供参考】"]
    for cat in result.get('categories', []):
        if cat['count'] == 0:
            continue
        # 列举每个分类的前3个文件
        sample = [f['name'] for f in cat['files'][:3]]
        lines.append(f"- {cat['icon']} {cat['name']}（{cat['count']}个）: {', '.join(sample)}")
        if cat['count'] > 3:
            lines.append(f"  ...还有 {cat['count'] - 3} 个文件")

    lines.append(f"\n共 {result['total_files']} 个本地文件，分布在 {len(result['categories'])} 个分类中。")
    lines.append("用户可以询问特定文件的内容，或要求搜索资料库中的相关资料。")
    return '\n'.join(lines)
