import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
} from 'antd';
import {
  DashboardOutlined,
  RobotOutlined,
  NodeIndexOutlined,
  SafetyCertificateOutlined,
  ApiOutlined,
  AppstoreOutlined,
  MessageOutlined,
  GlobalOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store';

/**
 * AdminPage — Operations management dashboard (aggregated entry point)
 * Provides quick access to all backend management pages
 */
const AdminPage: React.FC = () => {
  const { theme } = useAppStore();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const textColor = isDark ? '#e0e0e0' : '#262626';
  const mutedColor = isDark ? '#888888' : '#8c8c8c';
  const cardBg = isDark ? '#1f1f1f' : '#ffffff';
  const borderColor = isDark ? '#333333' : '#e8e8e8';

  const modules = [
    {
      title: '总览面板',
      path: '/admin/dashboard',
      icon: <DashboardOutlined className="text-2xl" />,
      color: '#1890ff',
      description: '系统运行状态、Agent统计、模型健康度',
      stats: '12 Agents 在线',
    },
    {
      title: 'Agent 管理',
      path: '/admin/agents',
      icon: <RobotOutlined className="text-2xl" />,
      color: '#52c41a',
      description: '创建、配置、启停各业务域Agent',
      stats: '12 个专家Agent',
    },
    {
      title: '工作流编排',
      path: '/admin/workflows',
      icon: <NodeIndexOutlined className="text-2xl" />,
      color: '#722ed1',
      description: 'DAG工作流设计、执行监控、节点管理',
      stats: '6 类工作流模板',
    },
    {
      title: '安全治理',
      path: '/admin/security',
      icon: <SafetyCertificateOutlined className="text-2xl" />,
      color: '#f5222d',
      description: '安全事件、审批队列、审计日志、哈希链校验',
      stats: 'L1-L5 五级架构',
    },
    {
      title: '模型管理',
      path: '/admin/models',
      icon: <ApiOutlined className="text-2xl" />,
      color: '#fa8c16',
      description: '15个模型配置、智能路由、健康检查',
      stats: '15 个模型',
    },
    {
      title: '业务域配置',
      path: '/admin/domains',
      icon: <AppstoreOutlined className="text-2xl" />,
      color: '#13c2c2',
      description: '12大生态环境业务域配置与管理',
      stats: '12 个业务域',
    },
    {
      title: '对话审计',
      path: '/admin/audit',
      icon: <MessageOutlined className="text-2xl" />,
      color: '#eb2f96',
      description: '全链路对话记录审计、SM3哈希链验证',
      stats: '全链路审计',
    },
    {
      title: '3D 数字孪生',
      path: '/admin/cesium',
      icon: <GlobalOutlined className="text-2xl" />,
      color: '#2f54eb',
      description: '湖南省3D地形、监测站点、天地图集成',
      stats: '8 个监测站',
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1" style={{ color: textColor }}>
          运维管理面板
        </h1>
        <p className="text-sm" style={{ color: mutedColor }}>
          系统配置、Agent管理、安全治理、模型监控等运维操作入口
        </p>
      </div>

      <Row gutter={[16, 16]}>
        {modules.map((mod) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={mod.path}>
            <Card
              hoverable
              className="cursor-pointer transition-all hover:shadow-lg"
              style={{
                backgroundColor: cardBg,
                borderColor,
              }}
              onClick={() => navigate(mod.path)}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: mod.color + '15',
                    color: mod.color,
                  }}
                >
                  {mod.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-medium" style={{ color: textColor }}>
                      {mod.title}
                    </h3>
                    <ArrowRightOutlined className="text-xs" style={{ color: mutedColor }} />
                  </div>
                  <p className="text-xs mt-1 mb-2" style={{ color: mutedColor }}>
                    {mod.description}
                  </p>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full inline-block"
                    style={{
                      backgroundColor: mod.color + '15',
                      color: mod.color,
                    }}
                  >
                    {mod.stats}
                  </span>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <div
        className="mt-6 p-4 rounded-lg text-sm"
        style={{
          backgroundColor: isDark ? '#1a1a1a' : '#fafafa',
          border: `1px solid ${borderColor}`,
          color: mutedColor,
        }}
      >
        <p className="mb-1">提示：此面板面向运维人员和技术管理员。普通用户请使用左侧的「对话界面」。</p>
        <p>如需返回对话界面，点击顶部导航栏的「返回对话界面」。</p>
      </div>
    </div>
  );
};

export default AdminPage;
