/**
 * 安全治理页面 — 安全事件 / 审批 / 审计 / 内容安全 (v6.5 合并 SecurityAudit)
 */
import React, { useState } from 'react';
import { Tabs, Button, Space, Typography } from 'antd';
import { ReloadOutlined, SafetyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import SecurityEventsTab from './components/SecurityEventsTab';
import ApprovalQueueTab from './components/ApprovalQueueTab';
import AuditLogTab from './components/AuditLogTab';
import ContentAuditTab from './components/ContentAuditTab';

const { Title, Text } = Typography;

const SecurityPage: React.FC = () => {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const tabItems = [
    {
      key: 'events',
      label: '安全事件',
      children: <SecurityEventsTab refreshKey={refreshKey} />,
    },
    {
      key: 'approvals',
      label: '审批队列',
      children: <ApprovalQueueTab refreshKey={refreshKey} />,
    },
    {
      key: 'audit',
      label: '审计日志',
      children: <AuditLogTab />,
    },
    {
      key: 'content-audit',
      label: <span><SafetyOutlined /> 内容审计</span>,
      children: <ContentAuditTab />,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {t('security.title')}
          </Title>
          <Text type="secondary">{t('security.description')}</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
          刷新
        </Button>
      </div>

      {/* Tab 切换 */}
      <Tabs items={tabItems} />
    </div>
  );
};

export default SecurityPage;
