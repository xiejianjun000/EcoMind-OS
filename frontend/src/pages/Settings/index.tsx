import React from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, Card, Switch, Select, Form, Divider, Space, Button } from 'antd';
import { useAppStore } from '@/store';

const { Title, Paragraph } = Typography;

/** System Settings Page */
const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme, locale, setLocale } = useAppStore();

  const handleLocaleChange = (value: 'zh-CN' | 'en-US') => {
    setLocale(value);
    i18n.changeLanguage(value);
  };

  return (
    <div className="p-6 max-w-3xl">
      <Title level={3}>{t('settings.title')}</Title>
      <Paragraph type="secondary">{t('settings.description')}</Paragraph>

      <Card className="mt-4" title="外观与语言">
        <Form layout="vertical">
          <Form.Item label={t('common.deployMode')}>
            <div className="flex items-center gap-2">
              <Switch
                checked={theme === 'dark'}
                onChange={toggleTheme}
                checkedChildren="🌙"
                unCheckedChildren="☀️"
              />
              <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </div>
          </Form.Item>
          <Form.Item label="Language / 语言">
            <Select
              value={locale}
              onChange={handleLocaleChange}
              style={{ width: 200 }}
              options={[
                { value: 'zh-CN', label: '简体中文' },
                { value: 'en-US', label: 'English' },
              ]}
            />
          </Form.Item>
        </Form>
      </Card>

      <Divider />

      <Card title="部署配置">
        <Space direction="vertical" className="w-full">
          <div className="flex justify-between items-center">
            <span>部署模式</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded text-xs font-medium">
              Local Only
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>API 地址</span>
            <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              http://localhost:8000
            </code>
          </div>
          <Button type="primary" size="small">
            {t('common.save')}
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default SettingsPage;
