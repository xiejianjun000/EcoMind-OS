/**
 * Login 页面 — 多角色登录
 *
 * 支持四种角色的快速登录:
 *   🏛️ 厅领导 / 👔 处长 / 🏙️ 市州 / 🛡️ 管理员
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

  /** Resolve redirect path from auth store after login */
  const getRedirectPath = (): string => {
    const { user } = useAuthStore.getState()
    if (!user) return '/chat'
    const role = user.role
    switch (role) {
      case 'leader': return '/chief-dashboard'
      case 'city': return '/city-dashboard'
      case 'admin': return '/admin/dashboard'
      default: return '/chat'
    }
  }

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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0F172A 100%)',
    }}>
      <div style={{ width: 480, maxWidth: '90vw' }}>
        {/* Logo + 标题 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, margin: '0 auto 16px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #00A86B, #3B82F6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32,
          }}>
            🌿
          </div>
          <Title level={2} style={{ color: '#F8FAFC', margin: 0 }}>EcoMind OS</Title>
          <Text style={{ color: '#94A3B8', fontSize: 15 }}>
            湖南省生态环境厅 · AI 指挥驾驶舱
          </Text>
        </div>

        {/* 登录表单 */}
        <Card
          style={{
            background: 'rgba(15,23,42,0.85)',
            borderColor: '#334155',
            borderRadius: 12,
            backdropFilter: 'blur(10px)',
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
                prefix={<UserOutlined style={{ color: '#94A3B8' }} />}
                placeholder="账号"
                style={{ background: '#1E293B', borderColor: '#334155', color: '#F8FAFC' }}
              />
            </Form.Item>

            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94A3B8' }} />}
                placeholder="密码"
                style={{ background: '#1E293B', borderColor: '#334155', color: '#F8FAFC' }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  height: 44,
                  background: 'linear-gradient(135deg, #00A86B, #10B981)',
                  border: 'none',
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                登 录
              </Button>
            </Form.Item>
          </Form>

          <Divider style={{ borderColor: '#334155', margin: '8px 0 16px' }}>
            <Text style={{ color: '#64748B', fontSize: 12 }}>快速登录</Text>
          </Divider>

          {/* 快速登录卡片 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_ACCOUNTS.map((acc) => (
              <Tag
                key={acc.username}
                style={{
                  cursor: 'pointer',
                  padding: '4px 12px',
                  background: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                onClick={() => handleQuickLogin(acc.username)}
              >
                <span style={{ marginRight: 4 }}>{acc.icon}</span>
                {acc.label}
              </Tag>
            ))}
          </div>

          <Paragraph style={{ marginTop: 16, textAlign: 'center', marginBottom: 0 }}>
            <Text style={{ color: '#475569', fontSize: 11 }}>
              演示环境 · 密码: 123456
            </Text>
          </Paragraph>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
