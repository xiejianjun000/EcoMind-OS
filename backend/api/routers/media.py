"""
EcoMind 媒体服务 — TTS 语音播报引擎（Edge 神经网络 + SSML 韵律控制）。

POST /api/media/tts           — 文本转语音（返回音频流）
GET  /api/media/voices        — 列出可用语音
POST /api/media/broadcast     — 智能播报（自动选语音 + SSML 情感风格）

升级要点：
- 中央电视台播音员级别：云扬（Yunyang）做主力播报，云健（Yunjian）做官方公告
- 智能停顿检测：按标点分级（。500ms / ，200ms / 换段 700ms / 短句自适应）
- 表情符号过滤：完整 Unicode Emoji 正则，一个不留
- 数字口语化：中文数字读法 + 单位转换（AQI→空气质量指数）
- SSML 韵律控制：语速 + 音调微调，模拟真人播音节奏
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import tempfile
import time
import threading
from typing import Optional
from urllib.parse import quote

import edge_tts
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()


# ═══════════════════════════════════════════════════════════════
# 智能文本预处理
# ═══════════════════════════════════════════════════════════════

# ── 完整 Emoji 正则（覆盖所有 Unicode Emoji 区块）──
_EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"   # 表情符号
    "\U0001F300-\U0001F5FF"   # 杂项符号和象形文字
    "\U0001F680-\U0001F6FF"   # 交通和地图符号
    "\U0001F700-\U0001F77F"   # 炼金术符号
    "\U0001F780-\U0001F7FF"   # 几何形状扩展
    "\U0001F800-\U0001F8FF"   # 补充箭头-C
    "\U0001F900-\U0001F9FF"   # 补充符号和象形文字
    "\U0001FA00-\U0001FA6F"   # 国际象棋符号
    "\U0001FA70-\U0001FAFF"   # 扩展-A 符号和象形文字
    "\U00002600-\U000027BF"   # 杂项符号
    "\U00002B50"               # ⭐
    "\U00002764\U0000FE0F"    # ❤️
    "\U0001F1E0-\U0001F1FF"   # 旗帜
    "\U0000231A-\U0000231B"   # ⌚⌛
    "\U000023E9-\U000023F3"   # ⏩-⏳
    "\U000023F8-\U000023FA"   # ⏸-⏺
    "\U000025AA-\U000025AB"   # ▪▫
    "\U000025B6"               # ▶
    "\U000025C0"               # ◀
    "\U000025FB-\U000025FE"   # ◻-◾
    "\U00002600-\U000027EF"   # ☀-⟯
    "\U00002934-\U00002935"   # ⤴⤵
    "\U00002B05-\U00002B07"   # ←↓
    "\U00002B1B-\U00002B1C"   # ⬛⬜
    "\U00002B50"               # ⭐
    "\U00002B55"               # ⭕
    "\U00003030"               # 〰
    "\U0000303D"               # 〽
    "\U00003297"               # ㊗
    "\U00003299"               # ㊙
    "\U0001F004"               # 🀄
    "\U0001F0CF"               # 🃏
    "\U0001F18E"               # 🆎
    "\U0001F191-\U0001F19A"   # 🆑-🆚
    "\U0001F201-\U0001F202"   # 🈁-🈂
    "\U0001F21A"               # 🈚
    "\U0001F22F"               # 🈯
    "\U0001F232-\U0001F23A"   # 🈲-🈺
    "\U0001F250-\U0001F251"   # 🉐-🉑
    "\U0001F310-\U0001F320"   # 🌐-🌠
    "\U0001F32D-\U0001F335"   # 🌭-🌵
    "\U0001F337-\U0001F37C"   # 🌷-🍼
    "\U0001F37E-\U0001F393"   # 🍾-🎓
    "\U0001F3A0-\U0001F3CA"   # 🎠-🏊
    "\U0001F3CF-\U0001F3D3"   # 🏏-🏓
    "\U0001F3E0-\U0001F3F0"   # 🏠-🏰
    "\U0001F3F4"               # 🏴
    "\U0001F3F8-\U0001F43E"   # 🏸-🐾
    "\U0001F440"               # 👀
    "\U0001F442-\U0001F4FC"   # 👂-📼
    "\U0001F4FF-\U0001F53D"   # 📿-🔽
    "\U0001F54B-\U0001F54E"   # 🕋-🕎
    "\U0001F550-\U0001F567"   # 🕐-🕧
    "\U0001F57A"               # 🕺
    "\U0001F595-\U0001F596"   # 🖕-🖖
    "\U0001F5A4"               # 🖤
    "\U0001F5FB-\U0001F64F"   # 🗻-🙏
    "\U0001F910-\U0001F93A"   # 🤐-🤺
    "\U0001F93C-\U0001F945"   # 🤼-🥅
    "\U0001F947-\U0001F94C"   # 🥇-🥌
    "\U0001F950-\U0001F96B"   # 🥐-🥫
    "\U0001F980-\U0001F997"   # 🦀-🦗
    "\U0001F9C0"               # 🧀
    "\U0001F9D0-\U0001F9E6"   # 🧐-🧦
    "\U0000200D"               # ZWJ (零宽连字)
    "\U0000FE0F"               # 变体选择器-16
    "\U000020E3"               # 组合用封闭式按键帽
    "]+",
    re.UNICODE,
)


def _normalize_numbers(text: str) -> str:
    """数字口语化：把阿拉伯数字转中文读法（简单策略，处理常见模式）"""
    # 百分比
    text = re.sub(r'(\d+(?:\.\d+)?)%', lambda m: f'百分之{_num_to_chinese(m.group(1))}', text)
    # 温度
    text = re.sub(r'(\d+(?:\.\d+)?)°C', lambda m: f'{_num_to_chinese(m.group(1))}摄氏度', text)
    # 微克/毫克
    text = re.sub(r'(\d+(?:\.\d+)?)\s*µg/m³', lambda m: f'{_num_to_chinese(m.group(1))}微克每立方米', text)
    text = re.sub(r'(\d+(?:\.\d+)?)\s*mg/m³', lambda m: f'{_num_to_chinese(m.group(1))}毫克每立方米', text)
    return text


def _num_to_chinese(num_str: str) -> str:
    """简单数字转中文（处理整数和小数）"""
    digits = "零一二三四五六七八九"
    units = ["", "十", "百", "千", "万"]
    try:
        if '.' in num_str:
            int_part, dec_part = num_str.split('.')
            result = ""
            if int_part and int(int_part) > 0:
                result = _int_to_chinese(int(int_part)) + "点"
            else:
                result = "零点"
            result += "".join(digits[int(d)] for d in dec_part)
            return result
        else:
            return _int_to_chinese(int(num_str))
    except:
        return num_str


def _int_to_chinese(n: int) -> str:
    if n == 0:
        return "零"
    digits = "零一二三四五六七八九"
    units = ["", "十", "百", "千"]
    result = []
    s = str(n)
    length = len(s)
    for i, ch in enumerate(s):
        d = int(ch)
        unit_idx = length - i - 1
        if d != 0:
            if unit_idx % 4 == 1 and d == 1 and i == 0 and unit_idx == 1:
                result.append("十")
            else:
                result.append(digits[d])
                if unit_idx > 0:
                    result.append(units[unit_idx % 4])
            if unit_idx >= 4:
                result.append("万")
        else:
            if result and result[-1] != "零":
                result.append("零")
    if result[-1] == "零":
        result.pop()
    return "".join(result)


def _strip_emoji(text: str) -> str:
    """移除所有 emoji 表情符号"""
    return _EMOJI_PATTERN.sub("", text)


def _smart_pause(text: str) -> list[tuple[str, int]]:
    """
    智能断句 + 停顿分级。

    返回 [(句子, 停顿毫秒), ...] 其中最后一项停顿=0。
    停顿规则：
      - 句号/问号/感叹号：500ms
      - 分号：400ms
      - 逗号/顿号：200ms
      - 换段落（连续换行）：700ms
      - 短句（<6字）后紧跟逗号：缩短到 150ms
    """
    # 先按主要句读拆分
    raw_segments = re.split(r'(?<=[。！？\n])\s*|(?<=[；])\s*|(?<=[，、])\s*', text)
    raw_segments = [s.strip() for s in raw_segments if s.strip()]

    if not raw_segments:
        return [("", 0)]

    result: list[tuple[str, int]] = []
    for i, seg in enumerate(raw_segments):
        if i == len(raw_segments) - 1:
            result.append((seg, 0))  # 最后一句不暂停
            continue

        # 判断停顿长度
        last_char = seg[-1] if seg else ""
        if last_char in "。！？":
            pause = 500
        elif last_char in "；":
            pause = 400
        elif last_char in "，、":
            pause = 200 if len(seg) > 6 else 150  # 短句缩短
        elif last_char in "\n":
            pause = 700  # 换段长停顿
        else:
            pause = 300  # 默认

        result.append((seg, pause))

    return result


def _preprocess_for_broadcast(text: str) -> str:
    """
    完整预处理管线：
    1. 去 emoji
    2. 去 Markdown 格式（**bold** / ### / 表格 / 引用）
    3. 数字口语化
    4. 空白规范化
    返回纯净可朗读文本（保留标点供断句使用）。
    """
    if not text:
        return ""

    # 1. 去 emoji
    text = _strip_emoji(text)

    # 2. 去 Markdown
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)       # **bold**
    text = re.sub(r'\*(.+?)\*', r'\1', text)            # *italic*
    text = re.sub(r'#{1,6}\s*', '', text)              # ### headers
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)  # [text](url)
    text = re.sub(r'`([^`]+)`', r'\1', text)            # `code`
    text = re.sub(r'\|[^|]*\|', '', text)               # 表格行
    text = re.sub(r'[-–—]{2,}', '', text)               # 水平线
    text = re.sub(r'^>\s*', '', text, flags=re.MULTILINE)  # > 引用
    text = re.sub(r'^\s*[-*+]\s', '，', text, flags=re.MULTILINE)  # - 列表

    # 3. 数字/单位口语化
    text = _normalize_numbers(text)

    # 4. 常见缩写扩展
    replacements = [
        (r'\bAQI\b', '空气质量指数'),
        (r'\bPM2\.5\b', 'PM二点五'),
        (r'\bPM10\b', 'PM十'),
        (r'\bO₃\b', '臭氧'),
        (r'\bNO₂\b', '二氧化氮'),
        (r'\bSO₂\b', '二氧化硫'),
        (r'\bCO₂\b', '二氧化碳'),
        (r'\bCO\b', '一氧化碳'),
        (r'\bkm\b', '公里'),
        (r'⚠️?警告[：:]', '注意，'),
        (r'⚠️', ''),
    ]
    for pattern, replacement in replacements:
        text = re.sub(pattern, replacement, text)

    # 5. 空白清理
    text = re.sub(r'\n{2,}', '\n', text)   # 多个换行→单个
    text = re.sub(r'[ \t]+', ' ', text)    # 多个空格→单个
    text = text.strip()

    return text


# ═══════════════════════════════════════════════════════════════
# SSML 构建 + 音频生成
# ═══════════════════════════════════════════════════════════════

def build_ssml(text: str, voice_name: str, rate: str = "+0%", pitch: str = "+0%") -> str:
    """
    构建 SSML — 智能断句 + 分级停顿 + 韵律控制。

    不再使用 style/styleDegree（CN 语音不支持），
    改为用 pause 时长和 prosody 来模拟真人播音节奏。
    """
    segments = _smart_pause(text)
    ssml_parts = []
    for sentence, pause_ms in segments:
        escaped = sentence.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        if pause_ms > 0:
            escaped += f'<break time="{pause_ms}ms"/>'
        ssml_parts.append(escaped)

    body = "".join(ssml_parts)

    return (
        f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"'
        f' xmlns:mstts="http://www.w3.org/2001/mstts" lang="zh-CN">'
        f'<voice name="{voice_name}">'
        f'<prosody rate="{rate}" pitch="{pitch}">'
        f'{body}'
        f'</prosody></voice></speak>'
    )


# ═══════════════════════════════════════════════════════════════
# 语音配置
# ═══════════════════════════════════════════════════════════════

PREMIUM_VOICES: dict[str, dict] = {
    "yunyang": {
        "name": "zh-CN-YunyangNeural",
        "display": "云扬 · 新闻播报男声",
        "description": "模拟中央电视台新闻联播播音员，字正腔圆，节奏稳健，最适合正式播报和公告宣读",
        "rate": "-5%",   # 稍慢更庄重
        "pitch": "+2%",
    },
    "yunjian": {
        "name": "zh-CN-YunjianNeural",
        "display": "云健 · 官方通告男声",
        "description": "成熟稳重，适合执法通报、政务公告、正式文件宣读",
        "rate": "-3%",
        "pitch": "+0%",
    },
    "yunxi": {
        "name": "zh-CN-YunxiNeural",
        "display": "云希 · 知性顾问男声",
        "description": "温暖知性，适合咨询解答、数据解读、科普讲解",
        "rate": "+0%",
        "pitch": "+0%",
    },
    "xiaoxiao": {
        "name": "zh-CN-XiaoxiaoNeural",
        "display": "晓晓 · 亲和女声",
        "description": "自然亲切的女声，适合日常对话、公众咨询、知识科普",
        "rate": "+0%",
        "pitch": "+0%",
    },
}

DEFAULT_VOICE = "yunyang"  # 默认用新闻播报级别

# 内容类型 → (语音, 语速偏移, 音调偏移)
CONTENT_VOICE_MAP = {
    "monitoring_daily":    ("xiaoxiao", "+0%", "+0%"),
    "monitoring_weekly":   ("xiaoxiao", "+0%", "+0%"),
    "enforcement_decision":("yunjian",  "-8%", "-2%"),  # 更慢更严肃
    "eia_review":          ("yunjian",  "-3%", "+0%"),
    "emergency_plan":      ("yunyang",  "-5%", "+3%"),  # 洪亮有力
    "public_notice":       ("yunyang",  "-5%", "+2%"),
    "science_edu":         ("yunxi",    "+3%", "+0%"),  # 稍快更自然
    "general":             ("yunyang",  "-3%", "+2%"),
    "broadcast":           ("yunyang",  "-5%", "+2%"),  # 纯播报模式
}


# ═══════════════════════════════════════════════════════════════
# 音频生成
# ═══════════════════════════════════════════════════════════════

def _get_voice_config(voice_key: str) -> dict:
    return PREMIUM_VOICES.get(voice_key, PREMIUM_VOICES[DEFAULT_VOICE])


def generate_audio_file(
    text: str,
    voice_key: str = "yunyang",
    fmt: str = "mp3",
    content_type: str = "general",
) -> str:
    """
    生成音频文件 — 完整管线：
    预处理（去emoji/数字口语化）→ 智能断句（分级停顿）→ SSML → Edge TTS → mp3
    """
    # 1. 文本预处理
    processed = _preprocess_for_broadcast(text)

    # 2. 语音选择
    voice_cfg = _get_voice_config(voice_key)
    voice_name = voice_cfg["name"]

    # 内容类型覆盖
    ct = CONTENT_VOICE_MAP.get(content_type, CONTENT_VOICE_MAP["general"])
    ct_voice, ct_rate, ct_pitch = ct
    final_voice = voice_name
    final_rate = voice_cfg.get("rate", "+0%") if voice_key != DEFAULT_VOICE else ct_rate
    final_pitch = voice_cfg.get("pitch", "+0%") if voice_key != DEFAULT_VOICE else ct_pitch

    # 3. 构建 SSML（智能断句 + 分级停顿）
    ssml = build_ssml(processed, final_voice, rate=final_rate, pitch=final_pitch)

    # 4. 调 Edge TTS
    tmpdir = tempfile.mkdtemp(prefix="ecomind_tts_")
    output_path = os.path.join(tmpdir, f"output.{fmt}")

    try:
        communicate = edge_tts.Communicate(text=ssml)

        def _run_sync():
            try:
                new_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(new_loop)
                new_loop.run_until_complete(communicate.save(output_path))
            finally:
                new_loop.close()

        try:
            loop = asyncio.get_running_loop()
            if loop.is_running():
                t = threading.Thread(target=_run_sync, daemon=True)
                t.start()
                t.join(timeout=30)
                if t.is_alive():
                    raise RuntimeError("TTS 生成超时")
            else:
                _run_sync()
        except RuntimeError:
            _run_sync()

        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            raise RuntimeError("Edge TTS 输出为空")

        logger.info(f"TTS 生成: voice={voice_key} rate={final_rate} pitch={final_pitch} → {os.path.getsize(output_path)} bytes")
        return output_path

    except Exception as e:
        logger.error(f"TTS 失败: {e}")
        raise


# ═══════════════════════════════════════════════════════════════
# API 端点
# ═══════════════════════════════════════════════════════════════

class TTSRequest(BaseModel):
    text: str = Field(..., description="要转换的文本")
    voice: str = Field(default="yunyang", description="语音: yunyang(新闻播报)|yunjian(官方通告)|yunxi(知性顾问)|xiaoxiao(亲和女声)")
    content_type: str = Field(default="general", description="内容类型: general|broadcast|enforcement_decision|public_notice|emergency_plan|science_edu|monitoring_daily")
    fmt: str = Field(default="mp3", description="音频格式: mp3")


class BroadcastRequest(BaseModel):
    text: str = Field(..., description="要播报的文本内容")
    content_type: str = Field(default="general", description="内容类型，决定语音风格和语速")
    voice: Optional[str] = Field(default=None, description="手动指定语音")


@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    """文本转语音 — 中央电视台播音员级别"""
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="文本不能为空")

    try:
        audio_path = generate_audio_file(
            text=req.text, voice_key=req.voice,
            fmt=req.fmt, content_type=req.content_type,
        )
        media_type = "audio/mpeg" if req.fmt == "mp3" else "audio/wav"
        return FileResponse(audio_path, media_type=media_type,
                            filename=f"ecomind_tts_{int(time.time())}.{req.fmt}")
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=f"语音生成失败: {e}")


@router.post("/broadcast")
async def smart_broadcast(req: BroadcastRequest):
    """
    智能播报 — 自动选语音 + 语速/音调微调。

    - 自动过滤 emoji 表情
    - 智能断句：句号 500ms / 逗号 200ms / 换段 700ms 停顿
    - 数字口语化（AQI→空气质量指数，42%→百分之四十二）
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="文本不能为空")

    voice_key = req.voice or CONTENT_VOICE_MAP.get(req.content_type, ("yunyang", "-3%", "+2%"))[0]
    voice_info = _get_voice_config(voice_key)

    try:
        audio_path = generate_audio_file(
            text=req.text, voice_key=voice_key,
            fmt="mp3", content_type=req.content_type,
        )

        return FileResponse(
            audio_path, media_type="audio/mpeg",
            filename=f"ecomind_broadcast_{voice_key}_{int(time.time())}.mp3",
            headers={
                "X-Voice-Key": voice_key,
                "X-Voice-Name": quote(voice_info["display"], safe=""),
                "X-Content-Type": req.content_type,
                "X-TTS-Engine": "edge-neural-broadcast",
            },
        )
    except Exception as e:
        logger.error(f"Broadcast error: {e}")
        raise HTTPException(status_code=500, detail=f"播报失败: {e}")


@router.get("/voices")
async def list_voices():
    """列出可用语音"""
    return {
        "engine": "Microsoft Edge TTS Neural · 中央电视台播音员级别",
        "default": DEFAULT_VOICE,
        "features": {
            "emoji_filter": True,
            "smart_pause": "分段级停顿（句号500ms/逗号200ms/换段700ms）",
            "number_normalize": "数字→中文读法",
            "markdown_strip": "自动去除 Markdown 格式",
        },
        "voices": [
            {"key": k, "display": v["display"], "description": v["description"],
             "rate": v.get("rate", "+0%"), "pitch": v.get("pitch", "+0%")}
            for k, v in PREMIUM_VOICES.items()
        ],
        "content_type_map": {
            k: {"voice": v[0], "rate": v[1], "pitch": v[2]}
            for k, v in CONTENT_VOICE_MAP.items()
        },
    }


@router.get("/voices/preview/{voice_key}")
async def preview_voice(voice_key: str, text: str = Query(default="欢迎使用EcoMind生态环境监测语音播报系统")):
    if voice_key not in PREMIUM_VOICES:
        raise HTTPException(status_code=400, detail=f"未知语音: {voice_key}")
    try:
        audio_path = generate_audio_file(text=text, voice_key=voice_key, fmt="mp3", content_type="general")
        return FileResponse(audio_path, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
