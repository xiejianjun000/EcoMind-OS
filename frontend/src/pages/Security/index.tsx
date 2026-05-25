/**
 * 安全治理页面 — VERIFY 幻觉检测、国密证书与审批流
 */
import React, { useState } from 'react';
import { Tabs, Button, Space, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import SecurityEventsTab from './components/SecurityEventsTab';
import ApprovalQueueTab from './components/ApprovalQueueTab';
import AuditLogTab from './components/AuditLogTab';

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
