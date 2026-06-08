/**
 * Login 页面 — 多角色登录
 * 
 * 设计基调: 政务驾驶舱 × 深色科技风
 * 视觉宣言: "权威而不冰冷 — 让登录成为进入指挥舱的仪式"
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Divider, Tag, message } from 'antd';
import {
  UserOutlined, LockOutlined, CrownOutlined,
  TeamOutlined, EnvironmentOutlined, SafetyOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/store';

const { Title, Text, Paragraph } = Typography;

/** 快速登录预设 */
const QUICK_ACCOUNTS: { label: string; role: string; username: string; icon: React.ReactNode; desc?: string }[] = [
  { label: '厅领导', role: 'leader', username: 'leader', icon: <CrownOutlined />, desc: '全局指挥驾驶舱' },
  { label: '执法局局长', role: 'chief', username: 'enforcement', icon: <TeamOutlined />, desc: '执法办案工作台' },
  { label: '监测处处长', role: 'chief', username: 'monitoring', icon: <TeamOutlined />, desc: '监测分析工作台' },
  { label: '长沙市局', role: 'city', username: 'changsha', icon: <EnvironmentOutlined />, desc: '属地环境管理' },
  { label: '系统管理员', role: 'admin', username: 'admin', icon: <SafetyOutlined />, desc: '系统安全治理' },
];

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const getRedirectPath = (): string => '/chat'

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      navigate(getRedirectPath(), { replace: true });
    } catch (err: any) {
      message.error(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (username: string) => {
    setLoading(true);
    try {
      await login(username, '123456');
      message.success('登录成功');
      navigate(getRedirectPath(), { replace: true });
    } catch (err: any) {
      message.error(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'hsl(158, 20%, 5%)' }}>
      <div style={{ width: 480, maxWidth: '90vw' }}>
        {/* Logo + 标题 */}
        <div className="text-center" style={{ marginBottom: 32 }}>
          <div className="mx-auto flex items-center justify-center rounded-2xl"
            style={{
              width: 72, height: 72, marginBottom: 16,
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--domain-water)))',
            }}>
            <span className="text-3xl select-none">🌿</span>
          </div>
          <Title level={2} className="!text-white !m-0">EcoMind OS</Title>
          <Text className="text-slate-400 text-[15px]">
            湖南省生态环境厅 · AI 指挥驾驶舱
          </Text>
        </div>

        {/* 登录表单 */}
        <Card
          className="border rounded-xl backdrop-blur-lg"
          style={{
            background: 'hsl(158 10% 7% / 0.85)',
            borderColor: 'hsl(var(--border))',
          }}
          bodyStyle={{ padding: 32 }}
        >
          <Form
            onFinish={handleLogin}
            initialValues={{ username: 'leader', password: '123456' }}
            size="large"
          >
            <Form.Item name="username" rules={[{ required: true, message: '请输入账号' }]}>
              <Input
                prefix={<UserOutlined className="text-slate-400" />}
                placeholder="账号"
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </Form.Item>

            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password
                prefix={<LockOutlined className="text-slate-400" />}
                placeholder="密码"
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                className="h-11 text-[15px] font-semibold !border-none"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(160, 55%, 42%))',
                }}
              >
                登 录
              </Button>
            </Form.Item>
          </Form>

          <Divider className="!border-slate-700 !my-2 !mb-4">
            <Text className="text-slate-500 text-xs">快速登录</Text>
          </Divider>

          {/* 快速登录卡片 */}
          <div className="flex flex-wrap gap-2">
            {QUICK_ACCOUNTS.map((acc) => (
              <Tag
                key={acc.username}
                className="cursor-pointer px-3 py-1 rounded-md text-xs bg-slate-800 border-slate-700"
                onClick={() => handleQuickLogin(acc.username)}
              >
                <span className="mr-1">{acc.icon}</span>
                {acc.label}
              </Tag>
            ))}
          </div>

          <Paragraph className="mt-4 text-center !mb-0">
            <Text className="text-slate-600 text-[11px]">
              演示环境 · 密码: 123456
            </Text>
          </Paragraph>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
