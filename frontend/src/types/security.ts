/**
 * Security Audit 安全审计类型 — v7.0
 * 灵感来源: QClaw 三级审计 (Prompt/Script/Skill)
 */

export type AuditLevel = 'L1' | 'L2' | 'L3';
export type AuditType = 'prompt' | 'response' | 'skill' | 'tool_call' | 'file_access';
export type AuditVerdict = 'pass' | 'flag' | 'block' | 'pending_review';

export interface SecurityAuditLog {
  id: string;
  type: AuditType;
  level: AuditLevel;
  verdict: AuditVerdict;
  userId: string;
  sessionId?: string;
  agentId?: string;
  /** 被审计的内容摘要（脱敏后） */
  contentSummary: string;
  /** 原始内容哈希 */
  contentHash: string;
  /** 匹配的规则 */
  matchedRules: string[];
  /** 审计结果详情 */
  details: string;
  reviewerId?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface AuditRule {
  id: string;
  name: string;
  type: AuditType;
  level: AuditLevel;
  pattern: string;
  description: string;
  action: 'log' | 'flag' | 'block';
  enabled: boolean;
  createdAt: string;
}

export interface ContentSafetyCheck {
  id: string;
  passed: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskCategories: string[];
  details: string;
  suggestions?: string[];
  checkedAt: string;
}

export interface SecurityStats {
  totalAudits: number;
  byVerdict: Record<AuditVerdict, number>;
  byType: Record<AuditType, number>;
  flaggedToday: number;
  blockedToday: number;
  pendingReview: number;
}

export const DEFAULT_AUDIT_RULES: AuditRule[] = [
  { id: 'r1', name: '敏感数据泄露检测', type: 'response', level: 'L3', pattern: '身份证号|手机号|统一社会信用代码', description: '检测AI回复中是否包含敏感个人信息', action: 'block', enabled: true, createdAt: new Date().toISOString() },
  { id: 'r2', name: '执法文书合规检查', type: 'response', level: 'L2', pattern: '处罚|罚款|停产|关闭', description: '涉及执法处罚内容的合规审查', action: 'flag', enabled: true, createdAt: new Date().toISOString() },
  { id: 'r3', name: '环境数据准确性', type: 'response', level: 'L1', pattern: 'AQI|PM2\\.5|PM10|SO2|NO2|O3|CO', description: '环境数据引用的准确性校验', action: 'log', enabled: true, createdAt: new Date().toISOString() },
  { id: 'r4', name: 'Prompt注入检测', type: 'prompt', level: 'L3', pattern: '<script>|eval\\(|__proto__|constructor\\[', description: '检测恶意Prompt注入攻击', action: 'block', enabled: true, createdAt: new Date().toISOString() },
  { id: 'r5', name: '涉密信息过滤', type: 'response', level: 'L3', pattern: '涉密|机密|绝密|内部文件', description: '防止涉密信息通过AI泄露', action: 'block', enabled: true, createdAt: new Date().toISOString() },
];
