"""
ECO-Audit V3.0 Phase 3 — 规则生成器

从案例中提取作弊模式特征，自动生成三种类型的检测规则：
  1. YARA 规则 — 用于 R001 隐藏菜单/后门扫描
  2. Python 检测函数 — 用于数据逻辑规则
  3. 正则表达式 — 用于日志审计规则

Usage:
    from engine.rule_generator import RuleGenerator
    gen = RuleGenerator()

    # 生成 YARA 规则
    yara = gen.generate_yara_rule(rule_id="126", pattern=rule_pattern)

    # 生成 Python 检测函数
    python_code = gen.generate_python_detector(rule_id="127", pattern=rule_pattern)

    # 生成正则表达式
    regex = gen.generate_regex_rule(rule_id="128", pattern=rule_pattern)
"""
from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


class RuleGenerator:
    """
    规则生成器

    根据规则模式的特征，自动生成对应类型的检测规则代码。
    支持 YARA、Python、Regex 三种输出格式。
    """

    def __init__(self):
        """初始化规则生成器"""
        self._yara_templates = self._load_yara_templates()
        self._python_templates = self._load_python_templates()
        self._regex_templates = self._load_regex_templates()
        logger.info("RuleGenerator 初始化完成")

    # ──────────────────────────────────────────────────────
    # YARA 规则生成
    # ──────────────────────────────────────────────────────

    def generate_yara_rule(self, rule_id: str, pattern: Any) -> str:
        """
        生成 YARA 规则

        YARA 规则用于扫描工控机及分析仪固件中的隐藏菜单入口、
        后门程序、默认工程密码等特征。

        Args:
            rule_id: 规则 ID（如 "126"）
            pattern: 规则模式对象（需有 feature_signatures, generic_description 等属性）

        Returns:
            YARA 规则文本
        """
        feature_sigs = getattr(pattern, "feature_signatures", [])
        description = getattr(pattern, "generic_description", "自动生成规则")
        category = getattr(pattern, "category", "unknown")
        if hasattr(category, "value"):
            category = category.value

        # 构建字符串特征
        strings_section = self._build_yara_strings(feature_sigs, rule_id)

        # 构建条件
        condition = self._build_yara_condition(feature_sigs, rule_id)

        # 元数据
        meta_section = (
            f'    description = "{self._escape_yara_str(description)}"\n'
            f'    category = "{category}"\n'
            f'    auto_generated = "true"\n'
            f'    rule_id = "R{rule_id}"\n'
        )

        yara_rule = f"""// ECO-Audit V3.0 自动生成 YARA 规则
// 规则ID: R{rule_id}
// 类别: {category}
// 生成时间: 自动

rule R{rule_id}
{{
    meta:
{meta_section}
    strings:
{strings_section}
    condition:
{condition}
}}
"""
        logger.info("生成 YARA 规则 R%s (%d 个特征)", rule_id, len(feature_sigs))
        return yara_rule

    def _load_yara_templates(self) -> dict[str, str]:
        """加载 YARA 规则模板"""
        return {
            "hidden_menu": """
    meta:
        description = "{description}"
        category = "{category}"
    strings:
        $admin = "admin" nocase
        $debug = "debug" nocase
        $engineer = "engineer" nocase
        $password = "password" nocase
        $factory = "factory" nocase
    condition:
        any of them
""",
            "backdoor": """
    meta:
        description = "{description}"
        category = "{category}"
    strings:
        $shell = "/bin/sh" nocase
        $exec = "exec(" nocase
        $system = "system(" nocase
        $eval = "eval(" nocase
    condition:
        any of them
""",
            "config_tamper": """
    meta:
        description = "{description}"
        category = "{category}"
    strings:
        $slope = "slope" nocase
        $intercept = "intercept" nocase
        $calibration = "calibration" nocase
        $range = "range" nocase
    condition:
        any of them
""",
        }

    def _build_yara_strings(self, features: list[str], rule_id: str) -> str:
        """构建 YARA 规则的 strings 段"""
        if not features:
            # 使用默认模板
            return (
                '    $suspicious1 = "admin" nocase\n'
                '    $suspicious2 = "debug" nocase\n'
                '    $suspicious3 = "engineer" nocase\n'
                '    $suspicious4 = "password" nocase\n'
                '    $suspicious5 = "factory" nocase\n'
            )

        lines = []
        for i, feature in enumerate(features[:15]):  # 最多 15 个特征
            safe_feature = self._escape_yara_str(feature)
            if len(safe_feature) <= 2:
                continue  # 跳过太短的特征
            # 判断是字符串还是十六进制模式
            if re.match(r'^[a-zA-Z0-9_\u4e00-\u9fff]{3,}$', safe_feature):
                lines.append(f'    $sig{i:02d} = "{safe_feature}" nocase')
            elif re.match(r'^[0-9a-fA-F ]+$', safe_feature):
                lines.append(f'    $sig{i:02d} = {{ {safe_feature} }}')

        if not lines:
            return (
                '    $suspicious1 = "admin" nocase\n'
                '    $suspicious2 = "debug" nocase\n'
            )

        return "\n".join(lines)

    def _build_yara_condition(self, features: list[str], rule_id: str) -> str:
        """构建 YARA 规则的 condition 段"""
        if len(features) <= 3:
            return "    any of them"
        elif len(features) <= 8:
            return "    2 of them"
        else:
            return "    3 of them"

    def _escape_yara_str(self, s: str) -> str:
        """转义 YARA 字符串中的特殊字符"""
        return s.replace('"', '\\"').replace("\\", "\\\\").replace("\n", "\\n")

    # ──────────────────────────────────────────────────────
    # Python 检测函数生成
    # ──────────────────────────────────────────────────────

    def generate_python_detector(self, rule_id: str, pattern: Any) -> str:
        """
        生成 Python 检测函数

        生成的函数用于数据逻辑规则检测，如参数一致性校验、
        数据突变检测、逻辑矛盾检测等。

        Args:
            rule_id: 规则 ID
            pattern: 规则模式对象

        Returns:
            Python 检测函数代码
        """
        category = getattr(pattern, "category", "unknown")
        if hasattr(category, "value"):
            category = category.value
        description = getattr(pattern, "generic_description", "自动生成的检测规则")
        feature_sigs = getattr(pattern, "feature_signatures", [])
        applicable_targets = getattr(pattern, "applicable_targets", ["CEMS"])

        # 根据类别选择检测函数模板
        template = self._select_python_template(category, feature_sigs)

        # 填充模板
        code = template.format(
            rule_id=rule_id,
            description=self._escape_python_str(description),
            category=category,
            targets=", ".join(f'"{t}"' for t in applicable_targets),
            feature_list=", ".join(f'"{f}"' for f in feature_sigs[:10]),
        )

        logger.info("生成 Python 检测函数 R%s (类别=%s)", rule_id, category)
        return code

    def _load_python_templates(self) -> dict[str, str]:
        """加载 Python 检测函数模板"""
        return {
            "parameter_check": '''
"""
R{rule_id}: {description}
类别: {category}
适用目标: [{targets}]
"""
from typing import Any


def detect_R{rule_id}(data: dict[str, Any], config: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    R{rule_id} 检测函数: {description}

    Args:
        data: 监测数据字典，包含各因子测量值
        config: 设备配置参数（可选）

    Returns:
        检测结果: {{
            "triggered": bool,      # 是否触发规则
            "severity": str,        # 严重等级
            "details": str,         # 详细说明
            "evidence": list,       # 证据数据
        }}
    """
    result = {{
        "triggered": False,
        "severity": "medium",
        "details": "",
        "evidence": [],
    }}

    try:
        # 检查数据完整性
        if not data:
            result["details"] = "输入数据为空"
            return result

        # 特征检测: {feature_list}
        features_to_check = [{feature_list}]

        for feature in features_to_check:
            if feature in data:
                value = data[feature]
                # 检查参数合理性
                if isinstance(value, (int, float)):
                    if value < 0:
                        result["triggered"] = True
                        result["severity"] = "high"
                        result["details"] = f"检测到异常参数: {{feature}}={{value}}"
                        result["evidence"].append({{"feature": feature, "value": value}})

        return result

    except Exception as e:
        result["details"] = f"检测过程异常: {{str(e)}}"
        return result
''',
            "logical_contradiction": '''
"""
R{rule_id}: {description}
类别: {category}
适用目标: [{targets}]
"""
from typing import Any


def detect_R{rule_id}(timeseries: list[dict[str, Any]], config: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    R{rule_id} 检测函数: {description}

    检测时间序列数据中的逻辑矛盾。

    Args:
        timeseries: 时间序列数据列表，每项包含时间戳和因子值
        config: 配置参数（可选）

    Returns:
        检测结果字典
    """
    result = {{
        "triggered": False,
        "severity": "medium",
        "details": "",
        "evidence": [],
    }}

    try:
        if not timeseries or len(timeseries) < 2:
            result["details"] = "数据点不足"
            return result

        # 特征检测: {feature_list}
        features = [{feature_list}]

        # 检查相邻数据点之间的异常变化
        for i in range(1, len(timeseries)):
            prev = timeseries[i - 1]
            curr = timeseries[i]

            for feature in features:
                if feature in prev and feature in curr:
                    prev_val = prev[feature]
                    curr_val = curr[feature]

                    if isinstance(prev_val, (int, float)) and isinstance(curr_val, (int, float)):
                        # 检测突变
                        change_rate = abs(curr_val - prev_val) / (abs(prev_val) + 1e-9)
                        if change_rate > 0.5:  # 变化超过 50%
                            result["triggered"] = True
                            result["evidence"].append({{
                                "index": i,
                                "feature": feature,
                                "prev_value": prev_val,
                                "curr_value": curr_val,
                                "change_rate": round(change_rate, 4),
                            }})

        if result["triggered"]:
            result["severity"] = "high"
            result["details"] = f"检测到 {{len(result['evidence'])}} 个逻辑矛盾点"

        return result

    except Exception as e:
        result["details"] = f"检测过程异常: {{str(e)}}"
        return result
''',
            "const_value": '''
"""
R{rule_id}: {description}
类别: {category}
适用目标: [{targets}]
"""
from typing import Any
import statistics


def detect_R{rule_id}(timeseries: list[dict[str, Any]], factor: str = "", threshold: float = 0.01) -> dict[str, Any]:
    """
    R{rule_id} 检测函数: {description}

    检测长期恒值/低波动异常（变异系数低于阈值）。

    Args:
        timeseries: 时间序列数据
        factor: 检测的因子名称
        threshold: 变异系数阈值（默认 1%）

    Returns:
        检测结果字典
    """
    result = {{
        "triggered": False,
        "severity": "medium",
        "details": "",
        "evidence": [],
    }}

    try:
        if not timeseries or len(timeseries) < 5:
            result["details"] = "数据点不足（需要至少5个）"
            return result

        target_factor = factor or ({feature_list}[0] if [{feature_list}] else "unknown")
        values = []
        for point in timeseries:
            if target_factor in point:
                v = point[target_factor]
                if isinstance(v, (int, float)):
                    values.append(v)

        if len(values) < 5:
            result["details"] = f"因子 {{target_factor}} 数据不足"
            return result

        # 计算变异系数
        mean_val = statistics.mean(values)
        if mean_val == 0:
            result["details"] = "平均值为0，无法计算变异系数"
            return result

        std_val = statistics.stdev(values)
        cv = std_val / abs(mean_val)

        if cv < threshold:
            result["triggered"] = True
            result["severity"] = "high"
            result["details"] = (
                f"因子 {{target_factor}} 长期恒值异常: "
                f"均值={{mean_val:.4f}}, 标准差={{std_val:.4f}}, CV={{cv:.4f}} < {{threshold}}"
            )
            result["evidence"].append({{
                "factor": target_factor,
                "mean": round(mean_val, 4),
                "stdev": round(std_val, 4),
                "cv": round(cv, 4),
                "data_points": len(values),
            }})

        return result

    except Exception as e:
        result["details"] = f"检测过程异常: {{str(e)}}"
        return result
''',
            "default": '''
"""
R{rule_id}: {description}
类别: {category}
适用目标: [{targets}]
"""
from typing import Any


def detect_R{rule_id}(data: dict[str, Any], context: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    R{rule_id} 检测函数: {description}

    Args:
        data: 待检测数据
        context: 上下文信息（可选）

    Returns:
        检测结果字典
    """
    result = {{
        "triggered": False,
        "severity": "medium",
        "details": "",
        "evidence": [],
    }}

    try:
        # 特征检测: {feature_list}
        features = [{feature_list}]

        if not data:
            result["details"] = "输入数据为空"
            return result

        # 通用异常检测逻辑
        for feature in features:
            if feature in data:
                value = data[feature]
                # 根据特征类型执行检测
                if isinstance(value, str) and len(value) > 0:
                    # 字符串特征检查
                    pass
                elif isinstance(value, (int, float)):
                    # 数值特征检查
                    if value < 0:
                        result["triggered"] = True
                        result["evidence"].append({{
                            "feature": feature,
                            "value": value,
                            "reason": "负值异常",
                        }})

        if result["triggered"]:
            result["severity"] = "high"
            result["details"] = f"检测到 {{len(result['evidence'])}} 个异常"

        return result

    except Exception as e:
        result["details"] = f"检测过程异常: {{str(e)}}"
        return result
''',
        }

    def _select_python_template(self, category: str, features: list[str]) -> str:
        """根据类别选择 Python 模板"""
        if category in ("tampering", "interference"):
            return self._python_templates.get("parameter_check", self._python_templates["default"])
        if category in ("forgery", "evasion"):
            return self._python_templates.get("logical_contradiction", self._python_templates["default"])
        if category == "instigation":
            return self._python_templates.get("const_value", self._python_templates["default"])
        return self._python_templates["default"]

    def _escape_python_str(self, s: str) -> str:
        """转义 Python 字符串中的特殊字符"""
        return s.replace('"', '\\"').replace("\\", "\\\\").replace("\n", " ")

    # ──────────────────────────────────────────────────────
    # 正则表达式生成
    # ──────────────────────────────────────────────────────

    def generate_regex_rule(self, rule_id: str, pattern: Any) -> str:
        """
        生成正则表达式规则

        用于日志审计规则，如检测日志中的异常操作记录、
        参数修改痕迹、时间戳异常等。

        Args:
            rule_id: 规则 ID
            pattern: 规则模式对象

        Returns:
            正则表达式规则（含注释和说明）
        """
        category = getattr(pattern, "category", "unknown")
        if hasattr(category, "value"):
            category = category.value
        description = getattr(pattern, "generic_description", "自动生成的日志审计规则")
        feature_sigs = getattr(pattern, "feature_signatures", [])

        # 构建正则表达式
        regex_patterns = self._build_regex_patterns(category, feature_sigs)

        # 生成完整的规则代码
        rule_code = f'''"""
R{rule_id}: {description}
类别: {category}
用途: 日志审计正则表达式规则
"""
import re
from typing import Any

# 正则表达式模式列表
R{rule_id}_PATTERNS = [
{self._format_regex_list(regex_patterns)}
]

# 编译后的正则表达式（预编译提升性能）
R{rule_id}_COMPILED = [re.compile(p, re.IGNORECASE | re.MULTILINE) for p in R{rule_id}_PATTERNS]


def detect_R{rule_id}(log_content: str, log_path: str = "") -> dict[str, Any]:
    """
    R{rule_id} 日志审计检测函数

    Args:
        log_content: 日志文本内容
        log_path: 日志文件路径（可选，用于结果溯源）

    Returns:
        检测结果字典
    """
    result = {{
        "triggered": False,
        "severity": "medium",
        "details": "",
        "evidence": [],
        "rule_id": "R{rule_id}",
        "log_path": log_path,
    }}

    try:
        if not log_content:
            result["details"] = "日志内容为空"
            return result

        for i, compiled_re in enumerate(R{rule_id}_COMPILED):
            matches = compiled_re.finditer(log_content)
            for match in matches:
                result["triggered"] = True
                result["evidence"].append({{
                    "pattern_index": i,
                    "matched_text": match.group()[:200],
                    "position": match.start(),
                }})

        if result["triggered"]:
            result["severity"] = "high"
            result["details"] = f"日志中发现 {{len(result['evidence'])}} 条匹配记录"

        return result

    except Exception as e:
        result["details"] = f"检测过程异常: {{str(e)}}"
        return result
'''
        logger.info("生成正则表达式规则 R%s (类别=%s, %d 个模式)", rule_id, category, len(regex_patterns))
        return rule_code

    def _load_regex_templates(self) -> dict[str, list[str]]:
        """加载正则表达式模板"""
        return {
            "tampering": [
                r'(?:修改|更改|alter|modify|update)\s+(?:参数|param|配置|config|setting)',
                r'(?:slope|intercept|校准|calibration)\s*=\s*[\d.]+',
                r'(?:删除|delete|remove)\s+(?:日志|log|记录|record)',
            ],
            "forgery": [
                r'(?:伪造|fabricate|fake|伪造数据)\s*(?:报告|report|数据|data)',
                r'(?:未.*监测|no.*monitor|未实际)\s*(?:出具|generate|出具数据)',
                r'(?:修改|alter)\s+(?:结果|result|报告|report)',
            ],
            "interference": [
                r'(?:稀释|dilut|注入|inject)\s*(?:气体|gas|空气|air|清洁)',
                r'(?:回流|return.*flow|尾气)\s*(?:稀释|干扰|interference)',
            ],
            "evasion": [
                r'(?:绕过|bypass|绕过.*监测|skip.*monitor)',
                r'(?:旁路|bypass.*pipe|旁通)\s*(?:排放|emit|直接)',
                r'(?:人为.*调整|manual.*adjust)\s*(?:工况|production)',
            ],
            "default": [
                r'(?:异常|anomaly|error|warning|异常操作)',
                r'(?:未授权|unauthorized|非法|illegal)\s*(?:操作|access|修改|access)',
            ],
        }

    def _build_regex_patterns(self, category: str, features: list[str]) -> list[str]:
        """构建正则表达式模式列表"""
        base_patterns = self._regex_templates.get(category, self._regex_templates["default"])

        # 从特征中补充模式
        feature_patterns = []
        for f in features[:5]:
            # 中文字符直接作为正则模式
            if re.match(r'^[\u4e00-\u9fff]{2,}$', f):
                feature_patterns.append(re.escape(f))
            # 英文字符转义后加入
            elif re.match(r'^[a-zA-Z]{3,}$', f):
                feature_patterns.append(re.escape(f))

        return base_patterns + feature_patterns

    def _format_regex_list(self, patterns: list[str]) -> str:
        """格式化正则表达式列表为 Python 代码"""
        lines = []
        for p in patterns:
            escaped = p.replace('"', '\\"')
            lines.append(f'    r"{escaped}",')
        return "\n".join(lines)

    # ──────────────────────────────────────────────────────
    # 工具方法
    # ──────────────────────────────────────────────────────

    def generate_all(self, rule_id: str, pattern: Any) -> dict[str, str]:
        """
        同时生成三种类型的规则

        Args:
            rule_id: 规则 ID
            pattern: 规则模式对象

        Returns:
            包含三种规则类型的字典 {yara, python, regex}
        """
        return {
            "yara": self.generate_yara_rule(rule_id, pattern),
            "python": self.generate_python_detector(rule_id, pattern),
            "regex": self.generate_regex_rule(rule_id, pattern),
        }
