/**
 * Experts 专家集市 — WorkBuddy 风格的全页专家布局
 *
 *   - 12 位生态环境专家 / 智能体
 *   - 卡片网格展示：头像、名称、状态、能力、模型等级、安全等级
 *   - 一键 "召唤" 进入对话
 *   - 按领域分类筛选 + 搜索
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tag, Button, Input, Typography, Row, Col, Space, Tooltip, Badge } from 'antd';
import {
  SearchOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  MessageOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useExpertStore } from '@/store/expertStore';
import { useChatStore } from '@/store/chatStore';
import type { Expert, ExpertCategory } from '@/types/expert';

const { Title, Text, Paragraph } = Typography;

// ─── 分类标签映射 ───

const categoryLabels: Record<ExpertCategory, string> = {
  general: '通用',
  monitoring: '监测',
  enforcement: '执法',
  eia: '环评',
  approval: '审批',
  biodiversity: '生物多样性',
  emission: '碳排放',
  emergency: '应急',
  restoration: '生态修复',
  inspection: '督察',
  public: '公众服务',
  water: '水资源',
};

const categoryColors: Record<ExpertCategory, string> = {
  general: '#52c41a',
  monitoring: '#1890ff',
  enforcement: '#f5222d',
  eia: '#722ed1',
  approval: '#eb2f96',
  biodiversity: '#13c2c2',
  emission: '#595959',
  emergency: '#fa8c16',
  restoration: '#237804',
  inspection: '#cf1322',
  public: '#2f54eb',
  water: '#096dd9',
};

const modelTierLabels: Record<string, string> = {
  opus: 'Opus 旗舰',
  sonnet: 'Sonnet 专业',
  haiku: 'Haiku 轻量',
};

const modelTierColors: Record<string, string> = {
  opus: 'purple',
  sonnet: 'blue',
  haiku: 'green',
};

const safetyLabels: Record<string, string> = {
  L1: '公开级',
  L2: '内部级',
  L3: '机密级',
};

const safetyColors: Record<string, string> = {
  L1: 'green',
  L2: 'blue',
  L3: 'red',
};

const statusConfig: Record<string, { color: string; label: string }> = {
  online: { color: '#52c41a', label: '在线' },
  busy: { color: '#faad14', label: '忙碌' },
  offline: { color: '#bfbfbf', label: '离线' },
  error: { color: '#ff4d4f', label: '异常' },
};

// ─── 专家团队分组 (用于团队卡片) ───

interface ExpertTeam {
  id: string;
  name: string;
  description: string;
  expertIds: string[];
  icon: string;
  color: string;
}

const expertTeams: ExpertTeam[] = [
  {
    id: 'team-enforcement',
    name: '执法监察组',
    description: '巡查取证、违规判定、处罚建议全链路',
    expertIds: ['enforcement', 'inspection'],
    icon: '⚖️',
    color: '#f5222d',
  },
  {
    id: 'team-eia',
    name: '环评审批组',
    description: '环评报告审查、合规校验、许可核发',
    expertIds: ['eia', 'permit'],
    icon: '📋',
    color: '#722ed1',
  },
  {
    id: 'team-monitoring',
    name: '环境监测组',
    description: '空气/水质/噪声/辐射全域监测分析',
    expertIds: ['env-monitoring', 'water', 'biodiversity'],
    icon: '📊',
    color: '#1890ff',
  },
  {
    id: 'team-emergency',
    name: '应急处置组',
    description: '突发事件应急响应与协同指挥',
    expertIds: ['emergency', 'env-monitoring', 'restoration'],
    icon: '🚨',
    color: '#fa8c16',
  },
  {
    id: 'team-carbon',
    name: '双碳工作组',
    description: '碳排放核算、减排方案、碳足迹分析',
    expertIds: ['carbon', 'eia'],
    icon: '🌿',
    color: '#237804',
  },
  {
    id: 'team-public',
    name: '公众服务组',
    description: '信息公开、投诉处理、政策解读',
    expertIds: ['public', 'ecomind'],
    icon: '👥',
    color: '#2f54eb',
  },
];

// ============================================================

const ExpertsPage: React.FC = () => {
  const navigate = useNavigate();
  const { experts } = useExpertStore();
  const { createSession } = useChatStore();
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState<ExpertCategory | 'all'>('all');

  // 过滤专家
  const filteredExperts = useMemo(() => {
    let list = experts;
    if (filterCategory !== 'all') {
      list = list.filter((e) => e.category === filterCategory);
    }
    if (searchText.trim()) {
      const kw = searchText.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.displayName.toLowerCase().includes(kw) ||
          e.description.toLowerCase().includes(kw) ||
          e.capabilities.some((c) => c.toLowerCase().includes(kw))
      );
    }
    return list;
  }, [experts, filterCategory, searchText]);

  // 召唤专家 → 创建会话并跳转
  const handleSummon = (expert: Expert) => {
    const sessionId = createSession({
      title: `与 ${expert.displayName} 的对话`,
      expertId: expert.id,
    });
    navigate(`/chat/${sessionId}`);
  };

  // 召唤团队 → 暂创建默认会话
  const handleSummonTeam = (team: ExpertTeam) => {
    const sessionId = createSession({
      title: `${team.name} 协作`,
      expertId: team.expertIds[0],
    });
    navigate(`/chat/${sessionId}`);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* ============================================================ */}
      {/* 页面头部 */}
      {/* ============================================================ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginRight: 8, color: '#52c41a' }} />
            专家集市
          </Title>
          <Text type="secondary">
            12 位生态环境领域专家，随时召唤到对话中协作
          </Text>
        </div>
        <Space>
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索专家名称、能力..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
        </Space>
      </div>

      {/* ============================================================ */}
      {/* 分类筛选 Chips */}
      {/* ============================================================ */}
      <div className="flex flex-wrap gap-2">
        <Tag
          color={filterCategory === 'all' ? 'green' : 'default'}
          style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13 }}
          onClick={() => setFilterCategory('all')}
        >
          全部 ({experts.length})
        </Tag>
        {(Object.keys(categoryLabels) as ExpertCategory[]).map((cat) => {
          const count = experts.filter((e) => e.category === cat).length;
          return (
            <Tag
              key={cat}
              color={filterCategory === cat ? categoryColors[cat] : 'default'}
              style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13 }}
              onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}
            >
              {categoryLabels[cat]} ({count})
            </Tag>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* 专家卡片网格 */}
      {/* ============================================================ */}
      <Row gutter={[16, 16]}>
        {filteredExperts.map((expert) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={expert.id}>
            <ExpertCard expert={expert} onSummon={() => handleSummon(expert)} />
          </Col>
        ))}
      </Row>

      {filteredExperts.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <RobotOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <p className="mt-2">未找到匹配的专家</p>
        </div>
      )}

      {/* ============================================================ */}
      {/* 专家团队 */}
      {/* ============================================================ */}
      <div>
        <Title level={4} style={{ marginTop: 32, marginBottom: 16 }}>
          <TeamOutlined style={{ marginRight: 8 }} />
          专家团队
        </Title>
        <Row gutter={[16, 16]}>
          {expertTeams.map((team) => {
            const teamExperts = experts.filter((e) => team.expertIds.includes(e.id));
            const onlineCount = teamExperts.filter((e) => e.status === 'online').length;
            return (
              <Col xs={24} sm={12} lg={8} key={team.id}>
                <Card
                  hoverable
                  className="h-full"
                  bodyStyle={{ padding: 16 }}
                  actions={[
                    <Button
                      key="summon"
                      type="primary"
                      size="small"
                      icon={<MessageOutlined />}
                      onClick={() => handleSummonTeam(team)}
                    >
                      召唤团队
                    </Button>,
                  ]}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                      style={{ backgroundColor: `${team.color}20`, color: team.color }}
                    >
                      {team.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base">{team.name}</div>
                      <Text type="secondary" className="text-xs">
                        {team.description}
                      </Text>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge color={onlineCount > 0 ? 'green' : 'default'} text={`${onlineCount}/${teamExperts.length} 在线`} />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {teamExperts.map((e) => (
                      <Tooltip key={e.id} title={e.displayName}>
                        <Tag
                          color={categoryColors[e.category]}
                          style={{ margin: 0, cursor: 'pointer' }}
                          onClick={() => handleSummon(e)}
                        >
                          {e.displayName}
                        </Tag>
                      </Tooltip>
                    ))}
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      </div>
    </div>
  );
};

// ============================================================
// 单个专家卡片
// ============================================================

interface ExpertCardProps {
  expert: Expert;
  onSummon: () => void;
}

const ExpertCard: React.FC<ExpertCardProps> = ({ expert, onSummon }) => {
  const status = statusConfig[expert.status] ?? statusConfig.offline;

  return (
    <Card
      hoverable
      className="h-full transition-all duration-200 hover:shadow-md"
      bodyStyle={{ padding: 16 }}
    >
      {/* 头部：头像 + 名称 + 状态 */}
      <div className="flex items-start gap-3 mb-3">
        <div className="relative flex-shrink-0">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
            style={{ backgroundColor: expert.color }}
          >
            {expert.displayName.slice(0, 2)}
          </div>
          <div
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white"
            style={{ backgroundColor: status.color }}
            title={status.label}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base truncate">{expert.displayName}</div>
          <Text type="secondary" className="text-xs">
            {expert.description.length > 30
              ? expert.description.slice(0, 30) + '...'
              : expert.description}
          </Text>
        </div>
      </div>

      {/* 标签行 */}
      <div className="flex flex-wrap gap-1 mb-3">
        <Tag color={categoryColors[expert.category]} style={{ margin: 0 }}>
          {categoryLabels[expert.category]}
        </Tag>
        <Tooltip title={`模型层级：${modelTierLabels[expert.modelTier]}`}>
          <Tag
            color={modelTierColors[expert.modelTier]}
            style={{ margin: 0 }}
            icon={<ThunderboltOutlined />}
          >
            {expert.modelTier.toUpperCase()}
          </Tag>
        </Tooltip>
        <Tooltip title={`安全等级：${safetyLabels[expert.safetyLevel]}`}>
          <Tag
            color={safetyColors[expert.safetyLevel]}
            style={{ margin: 0 }}
            icon={<SafetyCertificateOutlined />}
          >
            {expert.safetyLevel}
          </Tag>
        </Tooltip>
      </div>

      {/* 能力列表 */}
      <div className="flex flex-wrap gap-1 mb-3">
        {expert.capabilities.slice(0, 4).map((cap) => (
          <Tag key={cap} style={{ margin: 0, fontSize: 11 }}>
            {cap}
          </Tag>
        ))}
        {expert.capabilities.length > 4 && (
          <Tooltip title={expert.capabilities.slice(4).join('、')}>
            <Tag style={{ margin: 0, fontSize: 11, cursor: 'pointer' }}>
              +{expert.capabilities.length - 4}
            </Tag>
          </Tooltip>
        )}
      </div>

      {/* 召唤按钮 */}
      <Button
        type="primary"
        block
        icon={<MessageOutlined />}
        onClick={onSummon}
        disabled={expert.status === 'offline'}
        style={{
          backgroundColor: expert.status === 'offline' ? undefined : expert.color,
          borderColor: expert.status === 'offline' ? undefined : expert.color,
        }}
      >
        {expert.status === 'offline' ? '暂不可用' : '召唤专家'}
      </Button>
    </Card>
  );
};

export default ExpertsPage;
