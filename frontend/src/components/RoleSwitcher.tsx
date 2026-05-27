/**
 * RoleSwitcher — 角色切换器 (Header 中显示)
 *
 * 开发/演示阶段: 允许快速切换角色查看不同视角
 * 生产环境: 只显示当前角色信息 (不可切换)
 */
import React from 'react';
import { Dropdown, Button, message } from 'antd';
import type { MenuProps } from 'antd';
import {
  CrownOutlined, TeamOutlined, EnvironmentOutlined, SafetyOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useAuthStore, ROLE_CONFIGS, CITY_LIST } from '@/store';
import { DEFAULT_DEPT_AGENTS } from '@/services/types';

const RoleSwitcher: React.FC = () => {
  const { user, switchRole } = useAuthStore();
  if (!user) return null;

  const roleConfig = ROLE_CONFIGS[user.role];

  const menuItems: MenuProps['items'] = [
    {
      key: 'leader',
      label: '🏛️ 厅领导视图',
      icon: <CrownOutlined />,
      onClick: () => { switchRole('leader'); message.success('切换到厅领导视图'); },
    },
    { type: 'divider' },
    {
      key: 'chief-header',
      label: '👔 处长视图',
      icon: <TeamOutlined />,
      children: DEFAULT_DEPT_AGENTS
        .filter(d => d.priority === 'P0')
        .map(d => ({
          key: `chief-${d.agentKey}`,
          label: `${d.department}`,
          onClick: () => { switchRole('chief', d.department); message.success(`切换到 ${d.department} 视图`); },
        })),
    },
    { type: 'divider' },
    {
      key: 'city-header',
      label: '🏙️ 市州视图',
      icon: <EnvironmentOutlined />,
      children: CITY_LIST.slice(0, 7).map(c => ({
        key: `city-${c}`,
        label: c,
        onClick: () => { switchRole('city', c); message.success(`切换到 ${c} 视图`); },
      })),
    },
    { type: 'divider' },
    {
      key: 'admin',
      label: '🛡️ 管理员视图',
      icon: <SafetyOutlined />,
      onClick: () => { switchRole('admin'); message.success('切换到管理员视图'); },
    },
  ];

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
      <Button
        size="small"
        type="text"
        icon={<SwapOutlined />}
        style={{ color: '#94A3B8', fontSize: 12 }}
      >
        {roleConfig.icon} {roleConfig.label}
        {user.role === 'chief' && user.department ? ` · ${user.department.substring(0, 4)}` : ''}
        {user.role === 'city' && user.city ? ` · ${user.city}` : ''}
      </Button>
    </Dropdown>
  );
};

export default RoleSwitcher;
