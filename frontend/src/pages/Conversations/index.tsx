import React from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from 'antd';

const { Title, Paragraph } = Typography;

/** Conversation Audit Page */
const ConversationsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="p-6">
      <Title level={3}>{t('conversations.title')}</Title>
      <Paragraph type="secondary">{t('conversations.description')}</Paragraph>
    </div>
  );
};

export default ConversationsPage;
