import React from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, Card, Switch, Select, Form, Tabs, Descriptions } from 'antd';
import {
  SettingOutlined, CloudOutlined, DesktopOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store';
import ModelConfigTab from './components/ModelConfigTab';

const { Title, Paragraph, Text } = Typography;

/** System Settings Page — v6.5 模型配置 + 国产化部署 */
const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme, locale, setLocale } = useAppStore();

  const handleLocaleChange = (value: 'zh-CN' | 'en-US') => {
    setLocale(value);
    i18n.changeLanguage(value);
  };

  const tabItems = [
    {
      key: 'model',
      label: <><CloudOutlined /> 模型配置</>,
      children: <ModelConfigTab />,
    },
    {
      key: 'appearance',
      label: <><SettingOutlined /> 外观</>,
      children: (
        <Card title="外观与语言">
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
      ),
    },
    {
      key: 'deploy',
      label: <><DesktopOutlined /> 国产化部署</>,
      children: <DomesticDeployTab />,
    },
    {
      key: 'database',
      label: <><DatabaseOutlined /> 数据库</>,
      children: <DatabaseConfigTab />,
    },
  ];

  return (
    <div className="p-6 max-w-4xl">
      <Title level={3}>系统设置</Title>
      <Paragraph type="secondary">模型配置 · 国产化部署 · 数据库</Paragraph>
      <Tabs items={tabItems} defaultActiveKey="model" />
    </div>
  );
};

// ============================================================
// 国产化部署说明 Tab
// ============================================================

const DomesticDeployTab: React.FC = () => (
  <Card title="国产 CPU / OS 部署方案">
    <Tabs
      tabPosition="left"
      items={[
        {
          key: 'kunpeng',
          label: '鲲鹏 920',
          children: (
            <div className="space-y-3">
              <Title level={5}>华为鲲鹏 920 (ARM64)</Title>
              <Paragraph>
                湖南省级生态环境云平台标配 CPU，64 核 ARMv8.2，支持 NUMA 架构。
              </Paragraph>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="操作系统">openEuler 22.03 / 统信 UOS 服务器版 / 麒麟 V10</Descriptions.Item>
                <Descriptions.Item label="容器运行时">Docker CE ARM64 或 iSula (推荐国产化场景)</Descriptions.Item>
                <Descriptions.Item label="模型推理">
                  <Text code>ollama pull qwen2.5:14b</Text> (CPU 推理 14B 参数)
                  <br />
                  或 vLLM + GPU (Atlas 300I) 推理 72B
                </Descriptions.Item>
                <Descriptions.Item label="数据库">GaussDB (推荐) / openGauss / 达梦 DM8</Descriptions.Item>
              </Descriptions>
            </div>
          ),
        },
        {
          key: 'phytium',
          label: '飞腾 S2500',
          children: (
            <div className="space-y-3">
              <Title level={5}>飞腾 S2500 (ARM64)</Title>
              <Paragraph>市州级部署推荐，64 核 FTC663，适配麒麟/统信。</Paragraph>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="操作系统">银河麒麟 V10 / 统信 UOS 桌面版</Descriptions.Item>
                <Descriptions.Item label="模型推理">
                  <Text code>ollama pull qwen2.5:7b</Text> (CPU 推理 7B)
                  <br />
                  或 llama.cpp 量化 INT4 推理
                </Descriptions.Item>
                <Descriptions.Item label="数据库">达梦 DM8 标准版 / 人大金仓 KingbaseES</Descriptions.Item>
              </Descriptions>
            </div>
          ),
        },
        {
          key: 'loongson',
          label: '龙芯 3A6000',
          children: (
            <div className="space-y-3">
              <Title level={5}>龙芯 3A6000 (LoongArch)</Title>
              <Paragraph>个人工作站推荐，4 核 2.5GHz，LoongArch 自主指令集。</Paragraph>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="操作系统">Loongnix 20.3 / 统信 UOS 桌面版 (LoongArch)</Descriptions.Item>
                <Descriptions.Item label="模型推理">
                  llama.cpp (源码编译) 推理 Qwen2.5 3B/7B 量化版
                  <br />
                  <Text code>
                    git clone https://github.com/ggerganov/llama.cpp<br />
                    cd llama.cpp && make -j4<br />
                    ./llama-cli -m qwen2.5-7b-q4.gguf --temp 0.7
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="数据库">SQLite / 达梦 DM8 个人版</Descriptions.Item>
              </Descriptions>
            </div>
          ),
        },
      ]}
    />
  </Card>
);

// ============================================================
// 数据库配置 Tab
// ============================================================

const DatabaseConfigTab: React.FC = () => (
  <Card title="国产数据库适配">
    <Tabs
      items={[
        {
          key: 'dameng',
          label: '达梦 DM8',
          children: (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="厂商">武汉达梦数据库股份有限公司</Descriptions.Item>
              <Descriptions.Item label="连接方式">
                <Text code>JDBC: jdbc:dm://localhost:5236/ECOMIND</Text>
                <br />
                <Text code>ODBC: DSN=DM8;SERVER=localhost;UID=SYSDBA;PWD=***</Text>
              </Descriptions.Item>
              <Descriptions.Item label="后端适配">
                Python: dmPython / SQLAlchemy + dm-dialect
                <br />
                Go: golang DM 驱动
              </Descriptions.Item>
              <Descriptions.Item label="用途">审计日志 / 审批流程 / 环境监测数据主库</Descriptions.Item>
            </Descriptions>
          ),
        },
        {
          key: 'kingbase',
          label: '人大金仓',
          children: (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="厂商">北京人大金仓信息技术股份有限公司</Descriptions.Item>
              <Descriptions.Item label="连接方式">
                <Text code>JDBC: jdbc:kingbase8://localhost:54321/ECOMIND</Text>
              </Descriptions.Item>
              <Descriptions.Item label="兼容性">兼容 PostgreSQL 协议，可直接使用 pg 驱动</Descriptions.Item>
              <Descriptions.Item label="用途">用户管理 / RBAC 权限 / 知识库</Descriptions.Item>
            </Descriptions>
          ),
        },
        {
          key: 'opengauss',
          label: 'openGauss',
          children: (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="厂商">华为开源 (openGauss 社区)</Descriptions.Item>
              <Descriptions.Item label="连接方式">
                <Text code>JDBC: jdbc:opengauss://localhost:5432/ECOMIND</Text>
              </Descriptions.Item>
              <Descriptions.Item label="优势">鲲鹏平台深度优化，NUMA 感知，SM4 加密原生支持</Descriptions.Item>
              <Descriptions.Item label="用途">时序数据 / 向量存储 / 智能体记忆</Descriptions.Item>
            </Descriptions>
          ),
        },
      ]}
    />
  </Card>
);

export default SettingsPage;
