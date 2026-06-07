/**
 * Security Audit Banner — v7.0
 * 灵感来源: QClaw ContentSecurityError + 三级审计
 * 在对话中展示安全检查结果和风险提示
 */
import React from 'react';
import { Alert, Tag, Space } from 'antd';
import { SafetyOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, AuditOutlined } from '@ant-design/icons';
import type { ContentSafetyCheck } from '@/types/security';

interface Props {
  check: ContentSafetyCheck;
  className?: string;
}

const riskConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
  low: { color: 'green', icon: <CheckCircleOutlined />, text: '安全' },
  medium: { color: 'orange', icon: <WarningOutlined />, text: '注意' },
  high: { color: 'red', icon: <WarningOutlined />, text: '风险' },
  critical: { color: 'red', icon: <CloseCircleOutlined />, text: '严重风险' },
};

const SecurityAuditBanner: React.FC<Props> = ({ check, className = '' }) => {
  const config = riskConfig[check.riskLevel] || riskConfig.low;

  if (check.passed && check.riskLevel === 'low') return null;

  return (
    <div className={`security-audit-banner my-2 ${className}`}>
      <Alert
        type={check.passed ? 'warning' : 'error'}
        showIcon
        icon={<SafetyOutlined />}
        message={
          <Space>
            <span>安全审计</span>
            <Tag color={config.color}>{config.text}</Tag>
          </Space>
        }
        description={
          <div className="text-sm space-y-1">
            <div>{check.details}</div>
            {check.riskCategories.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {check.riskCategories.map((cat, i) => (
                  <Tag key={i} color="orange" className="text-xs">{cat}</Tag>
                ))}
              </div>
            )}
            {check.suggestions && check.suggestions.length > 0 && (
              <div className="mt-2 text-gray-500">
                <AuditOutlined className="mr-1" />
                {check.suggestions.join('；')}
              </div>
            )}
          </div>
        }
        className="rounded-lg"
      />
    </div>
  );
};

export default SecurityAuditBanner;
