"""
ECO-Audit V3.0 Phase 3 — 夜间反思服务

每日凌晨自动运行，分析当天所有审计结果，发现新的异常模式，
生成新规则建议，输出反思报告。

功能:
  - 分析当天所有审计结果
  - 发现新的异常模式（聚类分析 + 频率统计）
  - 生成新规则建议
  - 输出反思报告（JSON + 文本摘要）

触发类型支持:
  - 失败驱动: 审批驳回/用户纠正 → 即时触发
  - 模式驱动: 相似任务重复 N≥5 次 → 夜间批处理
  - 协作驱动: 观察到其他 Agent 新技能 → 异步触发
  - 计划驱动: 每周日 23:00 全量反思 → 定时触发

Usage:
    from engine.nightly_discovery import NightlyDiscovery
    discovery = NightlyDiscovery()
    report = await discovery.run_discovery()

    # 或手动指定日期范围
    report = await discovery.run_discovery(days_back=7)

    # 获取反思报告
    summary = discovery.format_report(report)
"""
from __future__ import annotations

import json
import logging
import sqlite3
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────
# 数据模型
# ──────────────────────────────────────────────────────


class PatternCluster(BaseModel):
    """发现的异常模式簇"""
    cluster_id: str = Field(default="")
    pattern_type: str
    count: int = Field(default=0)
    first_seen: str = Field(default="")
    last_seen: str = Field(default="")
    sample_audits: list[str] = Field(default_factory=list)
    severity: str = Field(default="medium")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    description: str = Field(default="")


class RuleSuggestion(BaseModel):
    """新规则建议"""
    suggestion_id: str = Field(default="")
    title: str
    description: str
    trigger_pattern: str
    suggested_detection_type: str = Field(default="python")  # yara / python / regex
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    related_cases: list[str] = Field(default_factory=list)
    legal_basis: list[str] = Field(default_factory=list)
    estimated_impact: str = Field(default="")


class NightlyReport(BaseModel):
    """夜间反思报告"""
    report_id: str = Field(default="")
    run_timestamp: str = Field(default="")
    period_start: str = Field(default="")
    period_end: str = Field(default="")
    audits_analyzed: int = Field(default=0)
    patterns_found: list[PatternCluster] = Field(default_factory=list)
    rule_suggestions: list[RuleSuggestion] = Field(default_factory=list)
    statistics: dict[str, Any] = Field(default_factory=dict)
    recommendations: list[str] = Field(default_factory=list)
    trigger_type: str = Field(default="nightly")  # nightly / failure / pattern / collaboration / weekly


# ──────────────────────────────────────────────────────
# 夜间反思服务
# ──────────────────────────────────────────────────────

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "evolution.db"
REPORTS_DIR = Path(__file__).resolve().parent.parent / "data" / "nightly_reports"


def _get_conn() -> sqlite3.Connection:
    """获取数据库连接"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


class NightlyDiscovery:
    """
    夜间反思服务

    每日凌晨自动分析审计结果，发现新的异常模式，
    生成新规则建议，输出反思报告。

    支持四种触发类型：
      1. 失败驱动 (failure) — 即时触发
      2. 模式驱动 (pattern) — 夜间批处理
      3. 协作驱动 (collaboration) — 异步触发
      4. 计划驱动 (weekly) — 每周日 23:00
    """

    def __init__(self):
        """初始化夜间反思服务"""
        self._case_library_path = Path(__file__).resolve().parent.parent / "data" / "case_library.json"
        self._legal_kb_path = Path(__file__).resolve().parent.parent / "data" / "legal_knowledge_base.json"
        # 确保报告目录存在
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        logger.info("NightlyDiscovery 初始化完成")

    async def run_discovery(
        self,
        days_back: int = 1,
        trigger_type: str = "nightly",
    ) -> NightlyReport:
        """
        执行夜间反思发现

        Args:
            days_back: 回溯天数（默认 1 天）
            trigger_type: 触发类型 (nightly/failure/pattern/collaboration/weekly)

        Returns:
            夜间反思报告
        """
        now = datetime.now()
        report = NightlyReport(
            report_id=f"RPT-{now.strftime('%Y%m%d-%H%M%S')}",
            run_timestamp=now.isoformat(),
            period_start=(now - timedelta(days=days_back)).isoformat(),
            period_end=now.isoformat(),
            trigger_type=trigger_type,
        )

        try:
            # Step 1: 收集审计数据
            audits = self._collect_audits(days_back)
            report.audits_analyzed = len(audits)
            logger.info("夜间反思: 收集到 %d 条审计记录", len(audits))

            if not audits:
                report.recommendations.append("无审计数据可供分析")
                return report

            # Step 2: 模式发现（聚类分析）
            patterns = self._discover_patterns(audits)
            report.patterns_found = patterns
            logger.info("夜间反思: 发现 %d 个异常模式簇", len(patterns))

            # Step 3: 生成规则建议
            suggestions = self._generate_rule_suggestions(patterns, audits)
            report.rule_suggestions = suggestions
            logger.info("夜间反思: 生成 %d 条规则建议", len(suggestions))

            # Step 4: 统计分析
            report.statistics = self._compute_statistics(audits, patterns)

            # Step 5: 生成建议
            report.recommendations = self._generate_recommendations(
                patterns, suggestions, audits,
            )

            # Step 6: 保存报告
            self._save_report(report)

            # Step 7: 持久化到数据库
            self._persist_report(report)

            logger.info(
                "夜间反思完成: 报告 %s, 分析 %d 审计, 发现 %d 模式, %d 建议",
                report.report_id, report.audits_analyzed,
                len(patterns), len(suggestions),
            )

        except Exception as e:
            logger.error("夜间反思异常: %s", e, exc_info=True)
            report.recommendations.append(f"反思过程异常: {str(e)}")

        return report

    # ── Step 1: 收集审计数据 ──

    def _collect_audits(self, days_back: int) -> list[dict[str, Any]]:
        """
        收集指定天数内的审计数据

        从 evolution.db 的 audit_history 表读取未处理的审计记录。

        Args:
            days_back: 回溯天数

        Returns:
            审计数据列表
        """
        conn = _get_conn()
        try:
            since = time.time() - days_back * 86400

            # 从 audit_history 读取
            rows = conn.execute(
                """SELECT audit_id, audit_data, processed
                   FROM audit_history
                   WHERE created_at >= ?
                   ORDER BY created_at""",
                (since,),
            ).fetchall()

            audits = []
            for row in rows:
                try:
                    data = json.loads(row["audit_data"])
                    data["_db_audit_id"] = row["audit_id"]
                    data["_processed"] = bool(row["processed"])
                    audits.append(data)
                except json.JSONDecodeError:
                    logger.warning("无法解析审计数据: %s", row["audit_id"][:8])

            return audits

        finally:
            conn.close()

    # ── Step 2: 模式发现 ──

    def _discover_patterns(self, audits: list[dict]) -> list[PatternCluster]:
        """
        发现异常模式簇

        使用以下方法：
          1. 频率统计：统计异常类型出现频率
          2. 共现分析：分析规则组合的共现模式
          3. 偏离检测：与历史基线对比的偏离模式

        Args:
            audits: 审计数据列表

        Returns:
            异常模式簇列表
        """
        clusters: list[PatternCluster] = []

        # 方法 1: 异常类型频率统计
        anomaly_type_counter = Counter()
        anomaly_samples: dict[str, list[str]] = defaultdict(list)

        for audit in audits:
            anomalies = audit.get("anomalies", [])
            for anomaly in anomalies:
                atype = anomaly.get("type", "unknown")
                anomaly_type_counter[atype] += 1
                audit_id = audit.get("audit_id", audit.get("_db_audit_id", ""))
                if len(anomaly_samples[atype]) < 5:
                    anomaly_samples[atype].append(audit_id)

        for atype, count in anomaly_type_counter.most_common(20):
            if count >= 2:  # 至少出现 2 次
                cluster = PatternCluster(
                    cluster_id=f"CLUSTER-{atype}",
                    pattern_type=atype,
                    count=count,
                    first_seen=self._get_first_timestamp(audits),
                    last_seen=self._get_last_timestamp(audits),
                    sample_audits=anomaly_samples[atype][:5],
                    severity="high" if count >= 10 else "medium" if count >= 5 else "low",
                    confidence=min(0.3 + count * 0.05, 0.95),
                    description=f"异常类型 '{atype}' 在 {count} 次审计中出现",
                )
                clusters.append(cluster)

        # 方法 2: 规则共现分析
        rule_combo_counter = Counter()
        combo_samples: dict[str, list[str]] = defaultdict(list)

        for audit in audits:
            triggered = audit.get("rules_triggered", [])
            if len(triggered) >= 2:
                combo = "+".join(sorted(triggered))
                rule_combo_counter[combo] += 1
                audit_id = audit.get("audit_id", audit.get("_db_audit_id", ""))
                if len(combo_samples[combo]) < 5:
                    combo_samples[combo].append(audit_id)

        for combo, count in rule_combo_counter.most_common(10):
            if count >= 3:  # 至少出现 3 次
                cluster = PatternCluster(
                    cluster_id=f"CLUSTER-COMBO-{hash(combo) % 10000:04d}",
                    pattern_type="rule_co_occurrence",
                    count=count,
                    first_seen=self._get_first_timestamp(audits),
                    last_seen=self._get_last_timestamp(audits),
                    sample_audits=combo_samples[combo][:5],
                    severity="high" if count >= 8 else "medium",
                    confidence=min(0.4 + count * 0.04, 0.9),
                    description=f"规则组合 [{combo}] 共现 {count} 次",
                )
                clusters.append(cluster)

        # 方法 3: 驳回/纠正模式
        rejection_reasons = Counter()
        rejection_samples: dict[str, list[str]] = defaultdict(list)

        for audit in audits:
            if audit.get("rejected"):
                reason = audit.get("rejection_reason", "unknown")[:50]
                rejection_reasons[reason] += 1
                audit_id = audit.get("audit_id", audit.get("_db_audit_id", ""))
                if len(rejection_samples[reason]) < 5:
                    rejection_samples[reason].append(audit_id)

        for reason, count in rejection_reasons.most_common(10):
            if count >= 2:
                cluster = PatternCluster(
                    cluster_id=f"CLUSTER-REJECT-{hash(reason) % 10000:04d}",
                    pattern_type="rejection_pattern",
                    count=count,
                    first_seen=self._get_first_timestamp(audits),
                    last_seen=self._get_last_timestamp(audits),
                    sample_audits=rejection_samples[reason][:5],
                    severity="high" if count >= 5 else "medium",
                    confidence=0.6,
                    description=f"驳回原因 '{reason}' 出现 {count} 次",
                )
                clusters.append(cluster)

        return clusters

    def _get_first_timestamp(self, audits: list[dict]) -> str:
        """获取最早时间戳"""
        timestamps = []
        for a in audits:
            ts = a.get("timestamp", a.get("created_at", 0))
            if ts:
                timestamps.append(float(ts))
        if timestamps:
            return datetime.fromtimestamp(min(timestamps)).isoformat()
        return datetime.now().isoformat()

    def _get_last_timestamp(self, audits: list[dict]) -> str:
        """获取最晚时间戳"""
        timestamps = []
        for a in audits:
            ts = a.get("timestamp", a.get("created_at", 0))
            if ts:
                timestamps.append(float(ts))
        if timestamps:
            return datetime.fromtimestamp(max(timestamps)).isoformat()
        return datetime.now().isoformat()

    # ── Step 3: 规则建议生成 ──

    def _generate_rule_suggestions(
        self,
        patterns: list[PatternCluster],
        audits: list[dict],
    ) -> list[RuleSuggestion]:
        """
        根据发现的模式生成新规则建议

        Args:
            patterns: 异常模式簇列表
            audits: 审计数据列表

        Returns:
            规则建议列表
        """
        suggestions: list[RuleSuggestion] = []
        known_rules = self._load_known_rule_ids()
        case_library = self._load_case_library()

        for pattern in patterns:
            if pattern.confidence < 0.5:
                continue  # 置信度太低，不生成建议

            # 判断是否已有类似规则
            related_existing = self._find_related_rules(pattern, known_rules)
            if related_existing and pattern.confidence < 0.7:
                continue  # 已有类似规则且置信度不高

            # 生成建议
            suggestion = self._create_suggestion(pattern, audits, case_library)
            if suggestion:
                suggestions.append(suggestion)

        # 排序：按置信度降序
        suggestions.sort(key=lambda s: -s.confidence)

        return suggestions

    def _load_known_rule_ids(self) -> set[str]:
        """加载已知规则 ID"""
        mapping_path = Path(__file__).resolve().parent.parent / "data" / "rule_legal_mapping.json"
        if mapping_path.exists():
            with open(mapping_path, "r", encoding="utf-8") as f:
                return set(json.load(f).keys())
        return set()

    def _load_case_library(self) -> list[dict]:
        """加载案例库"""
        if self._case_library_path.exists():
            with open(self._case_library_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("cases", [])
        return []

    def _find_related_rules(self, pattern: PatternCluster, known_rules: set[str]) -> list[str]:
        """查找与模式相关的已知规则"""
        related = []
        pattern_text = (pattern.pattern_type + " " + pattern.description).lower()

        for rule_id in known_rules:
            if any(kw in pattern_text for kw in [rule_id.lower()]):
                related.append(rule_id)

        return related

    def _create_suggestion(
        self,
        pattern: PatternCluster,
        audits: list[dict],
        case_library: list[dict],
    ) -> Optional[RuleSuggestion]:
        """创建单条规则建议"""
        # 检测类型推断
        detection_type = self._infer_detection_type(pattern)

        # 查找相关案例
        related_cases = self._find_related_cases(pattern, case_library)

        # 法律依据推断
        legal_basis = self._infer_legal_basis(pattern, case_library)

        # 影响评估
        impact = self._estimate_impact(pattern, audits)

        return RuleSuggestion(
            suggestion_id=f"SUG-{pattern.cluster_id}",
            title=f"建议规则: 检测{pattern.pattern_type}模式",
            description=pattern.description,
            trigger_pattern=pattern.pattern_type,
            suggested_detection_type=detection_type,
            confidence=pattern.confidence,
            related_cases=related_cases,
            legal_basis=legal_basis,
            estimated_impact=impact,
        )

    def _infer_detection_type(self, pattern: PatternCluster) -> str:
        """推断检测类型"""
        text = (pattern.pattern_type + " " + pattern.description).lower()
        if any(kw in text for kw in ["隐藏", "后门", "菜单", "yara", "扫描"]):
            return "yara"
        if any(kw in text for kw in ["日志", "log", "正则", "regex"]):
            return "regex"
        return "python"

    def _find_related_cases(
        self, pattern: PatternCluster, case_library: list[dict]
    ) -> list[str]:
        """查找相关案例"""
        related = []
        pattern_text = (pattern.pattern_type + " " + pattern.description).lower()
        for case in case_library:
            case_text = (
                case.get("name", "") + " " + case.get("description", "")
            ).lower()
            if any(kw in case_text for kw in pattern.pattern_type.split("_") if len(kw) > 2):
                related.append(case.get("id", ""))
        return related[:5]

    def _infer_legal_basis(
        self, pattern: PatternCluster, case_library: list[dict]
    ) -> list[str]:
        """推断法律依据"""
        legal_set = set()
        related_cases = self._find_related_cases(pattern, case_library)

        for case in case_library:
            if case.get("id") in related_cases:
                legal_set.update(case.get("legal_basis", []))

        return list(legal_set)[:5]

    def _estimate_impact(self, pattern: PatternCluster, audits: list[dict]) -> str:
        """评估规则影响"""
        total = len(audits)
        affected = pattern.count
        rate = affected / max(total, 1)

        if rate > 0.3:
            return f"高影响: 影响 {affected}/{total} ({rate:.0%}) 次审计"
        elif rate > 0.1:
            return f"中影响: 影响 {affected}/{total} ({rate:.0%}) 次审计"
        else:
            return f"低影响: 影响 {affected}/{total} ({rate:.0%}) 次审计"

    # ── Step 4: 统计分析 ──

    def _compute_statistics(
        self,
        audits: list[dict],
        patterns: list[PatternCluster],
    ) -> dict[str, Any]:
        """计算统计数据"""
        stats: dict[str, Any] = {
            "total_audits": len(audits),
            "total_anomalies": 0,
            "total_rejections": 0,
            "total_corrections": 0,
            "avg_confidence": 0.0,
            "pattern_distribution": {},
            "industry_distribution": {},
        }

        confidences = []
        anomaly_counter = Counter()
        industry_counter = Counter()

        for audit in audits:
            anomalies = audit.get("anomalies", [])
            stats["total_anomalies"] += len(anomalies)

            if audit.get("rejected"):
                stats["total_rejections"] += 1
            if audit.get("user_correction"):
                stats["total_corrections"] += 1

            conf = audit.get("confidence")
            if conf is not None:
                confidences.append(float(conf))

            for anomaly in anomalies:
                anomaly_counter[anomaly.get("type", "unknown")] += 1

            industry = audit.get("industry", "")
            if industry:
                industry_counter[industry] += 1

        stats["avg_confidence"] = round(
            sum(confidences) / max(len(confidences), 1), 3
        )
        stats["pattern_distribution"] = dict(anomaly_counter.most_common(10))
        stats["industry_distribution"] = dict(industry_counter.most_common(10))
        stats["patterns_found"] = len(patterns)

        return stats

    # ── Step 5: 生成建议 ──

    def _generate_recommendations(
        self,
        patterns: list[PatternCluster],
        suggestions: list[RuleSuggestion],
        audits: list[dict],
    ) -> list[str]:
        """生成行动建议"""
        recommendations = []

        # 基于模式数量
        if len(patterns) >= 5:
            recommendations.append(
                f"发现 {len(patterns)} 个异常模式簇，建议优先审查高置信度模式"
            )

        # 基于规则建议
        if suggestions:
            high_conf = [s for s in suggestions if s.confidence >= 0.7]
            if high_conf:
                recommendations.append(
                    f"有 {len(high_conf)} 条高置信度规则建议 (confidence≥0.7)，建议人工审核后纳入规则库"
                )

        # 基于驳回率
        rejections = sum(1 for a in audits if a.get("rejected"))
        if rejections > 0 and len(audits) > 0:
            rejection_rate = rejections / len(audits)
            if rejection_rate > 0.2:
                recommendations.append(
                    f"驳回率较高 ({rejection_rate:.0%})，建议审查规则准确性"
                )

        # 基于用户纠正
        corrections = sum(1 for a in audits if a.get("user_correction"))
        if corrections >= 3:
            recommendations.append(
                f"收到 {corrections} 条用户纠正，建议更新相关检测逻辑"
            )

        # 通用建议
        if not recommendations:
            recommendations.append("系统运行正常，未发现显著异常模式")

        return recommendations

    # ── 报告保存与持久化 ──

    def _save_report(self, report: NightlyReport):
        """保存反思报告到文件"""
        filepath = REPORTS_DIR / f"{report.report_id}.json"
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report.model_dump(), f, ensure_ascii=False, indent=2)
        logger.info("反思报告已保存: %s", filepath)

    def _persist_report(self, report: NightlyReport):
        """持久化反思报告到数据库"""
        conn = _get_conn()
        try:
            # 记录发现的模式
            for pattern in report.patterns_found:
                conn.execute(
                    """INSERT INTO observations
                       (obs_id, source_audit_id, pattern_type, description,
                        severity, confidence, evidence, timestamp)
                       VALUES (?, '', ?, ?, ?, ?, ?, ?)""",
                    (
                        pattern.cluster_id, pattern.pattern_type,
                        pattern.description, pattern.severity,
                        pattern.confidence,
                        json.dumps(pattern.sample_audits, ensure_ascii=False),
                        time.time(),
                    ),
                )

            # 记录洞察
            for suggestion in report.rule_suggestions:
                conn.execute(
                    """INSERT INTO insights
                       (insight_id, source_observations, category, analysis,
                        is_novel, novelty_reason, confidence, related_existing_rules, timestamp)
                       VALUES (?, '[]', 'unknown', ?, 1, ?, ?, '[]', ?)""",
                    (
                        suggestion.suggestion_id, suggestion.description,
                        suggestion.estimated_impact, suggestion.confidence,
                        time.time(),
                    ),
                )

            conn.commit()
        finally:
            conn.close()

    # ── 报告格式化 ──

    def format_report(self, report: NightlyReport) -> str:
        """
        将反思报告格式化为可读文本

        Args:
            report: 夜间反思报告

        Returns:
            格式化的报告文本
        """
        lines = [
            "=" * 60,
            "ECO-Audit V3.0 夜间反思报告",
            "=" * 60,
            f"报告 ID: {report.report_id}",
            f"运行时间: {report.run_timestamp}",
            f"分析周期: {report.period_start} ~ {report.period_end}",
            f"触发类型: {report.trigger_type}",
            f"审计分析数: {report.audits_analyzed}",
            "",
        ]

        # 统计摘要
        stats = report.statistics
        if stats:
            lines.extend([
                "── 统计摘要 ──",
                f"  总审计数: {stats.get('total_audits', 0)}",
                f"  总异常数: {stats.get('total_anomalies', 0)}",
                f"  驳回数: {stats.get('total_rejections', 0)}",
                f"  用户纠正数: {stats.get('total_corrections', 0)}",
                f"  平均置信度: {stats.get('avg_confidence', 0):.3f}",
                "",
            ])

        # 发现的模式
        if report.patterns_found:
            lines.append(f"── 发现的异常模式 ({len(report.patterns_found)}) ──")
            for i, pattern in enumerate(report.patterns_found, 1):
                lines.extend([
                    f"  [{i}] {pattern.pattern_type}",
                    f"      出现次数: {pattern.count}",
                    f"      严重等级: {pattern.severity}",
                    f"      置信度: {pattern.confidence:.2f}",
                    f"      描述: {pattern.description}",
                    "",
                ])
        else:
            lines.append("── 发现的异常模式: 无 ──\n")

        # 规则建议
        if report.rule_suggestions:
            lines.append(f"── 新规则建议 ({len(report.rule_suggestions)}) ──")
            for i, sug in enumerate(report.rule_suggestions, 1):
                lines.extend([
                    f"  [{i}] {sug.title}",
                    f"      检测类型: {sug.suggested_detection_type}",
                    f"      置信度: {sug.confidence:.2f}",
                    f"      描述: {sug.description}",
                    f"      影响评估: {sug.estimated_impact}",
                    "",
                ])
        else:
            lines.append("── 新规则建议: 无 ──\n")

        # 建议
        if report.recommendations:
            lines.append("── 行动建议 ──")
            for rec in report.recommendations:
                lines.append(f"  • {rec}")

        lines.extend(["", "=" * 60])

        return "\n".join(lines)
