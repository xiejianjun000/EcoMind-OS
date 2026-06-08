/**
 * InspirationPanel — 灵感推荐面板 (WorkBuddy Inspiration 对应)
 *
 * 功能:
 * - 基于上下文的智能提示推荐
 * - 环境数据洞察灵感
 * - 执法建议模板
 * - 一键填充到输入框
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  Card, Tag, Button, Typography, Row, Col, Space, Tooltip,
  Input, List, Skeleton, Empty, Tabs, Badge,
} from 'antd';
import {
  BulbOutlined, ThunderboltOutlined, ExperimentOutlined,
  SafetyOutlined, GlobalOutlined, BarChartOutlined,
  FileTextOutlined, AlertOutlined, FireOutlined,
  ArrowRightOutlined, SendOutlined, CopyOutlined,
  ReloadOutlined, StarOutlined, StarFilled,
  EyeOutlined, CompassOutlined, DashboardOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ─── 类型定义 ───

interface InspirationItem {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: InspirationCategory;
  tags: string[];
  icon: React.ReactNode;
  difficulty: 'easy' | 'medium' | 'advanced';
  usageCount: number;
  favorite: boolean;
}

type InspirationCategory = 'monitoring' | 'enforcement' | 'analysis' | 'reporting' | 'emergency' | 'compliance';

// ─── 灵感数据 ───

const INSPIRATION_DATA: InspirationItem[] = [
  {
    id: 'insp-1',
    title: '本周空气质量趋势分析',
    description: '分析最近7天AQI变化趋势，标注主要污染因子并给出健康建议',
    prompt: '请分析长沙市最近7天的空气质量变化趋势，重点关注 PM2.5、PM10、O3 的变化规律，分析气象条件的影响，并给出公众健康防护建议。',
    category: 'monitoring',
    tags: ['空气', 'AQI', '趋势', '健康'],
    icon: <GlobalOutlined />,
    difficulty: 'easy',
    usageCount: 2380,
    favorite: true,
  },
  {
    id: 'insp-2',
    title: '执法案卷智能审核',
    description: '对已录入的环境执法案卷进行合规性审核，检查法律适用是否准确',
    prompt: '请审核以下环境执法案卷的合规性：检查法律条款引用是否正确、处罚幅度是否适当、程序是否合法、证据是否充分，并生成审核意见书。',
    category: 'enforcement',
    tags: ['执法', '审核', '合规', '案卷'],
    icon: <SafetyOutlined />,
    difficulty: 'medium',
    usageCount: 1560,
    favorite: false,
  },
  {
    id: 'insp-3',
    title: '水质异常溯源分析',
    description: '根据水质监测数据异常，反向追踪可能的污染源头',
    prompt: '岳麓区湘江支流监测到氨氮浓度超标 2.3 倍，请根据流域水文数据、上游企业分布、近期降雨情况，进行污染源回溯分析，定位最可能的污染来源。',
    category: 'analysis',
    tags: ['水质', '溯源', '氨氮', '湘江'],
    icon: <ExperimentOutlined />,
    difficulty: 'advanced',
    usageCount: 890,
    favorite: true,
  },
  {
    id: 'insp-4',
    title: '月度执法报告生成',
    description: '自动汇总本月执法数据，生成标准化月度工作报告',
    prompt: '请根据以下数据生成本月环境执法月度报告：汇总本月执法检查次数、发现违法行为数量、下达处罚决定数量、罚款金额合计、重点案例简述，以及下月工作计划。',
    category: 'reporting',
    tags: ['报告', '月度', '执法', '统计'],
    icon: <FileTextOutlined />,
    difficulty: 'easy',
    usageCount: 3240,
    favorite: true,
  },
  {
    id: 'insp-5',
    title: '突发环境事件应急预案',
    description: '针对化学品泄漏场景，生成应急处置方案',
    prompt: '某化工园区发生苯系物储罐泄漏事故，请立即生成应急处置方案：包括人员疏散范围、污染控制措施、监测布点方案、信息上报流程和舆情应对策略。',
    category: 'emergency',
    tags: ['应急', '泄漏', '化学品', '预案'],
    icon: <AlertOutlined />,
    difficulty: 'advanced',
    usageCount: 1240,
    favorite: false,
  },
  {
    id: 'insp-6',
    title: '环保督察整改方案',
    description: '针对上级环保督察反馈问题，制定系统整改方案',
    prompt: '针对中央环保督察组反馈的"工业园区污水处理设施运行不稳定"问题，请制定系统性整改方案，包括短期应急措施、中期技术改造和长期管理机制。',
    category: 'compliance',
    tags: ['督察', '整改', '污水', '方案'],
    icon: <SafetyOutlined />,
    difficulty: 'medium',
    usageCount: 1890,
    favorite: false,
  },
  {
    id: 'insp-7',
    title: '噪声污染防治分析',
    description: '分析城市功能区噪声污染现状及变化趋势',
    prompt: '请分析长沙市各功能区（居住区、商业区、工业区、交通干线）噪声监测数据，评估达标率，识别重点噪声源，提出针对性防控措施。',
    category: 'analysis',
    tags: ['噪声', '功能区', '评估', '防控'],
    icon: <BarChartOutlined />,
    difficulty: 'medium',
    usageCount: 760,
    favorite: false,
  },
  {
    id: 'insp-8',
    title: '生态环境损害赔偿评估',
    description: '对企业污染造成的生态环境损害进行量化评估',
    prompt: '请根据提供的污染事件基本情况，运用虚拟治理成本法和生态环境损害评估技术指南，定量评估该企业违法排污造成的生态环境损害价值，并生成评估报告。',
    category: 'enforcement',
    tags: ['赔偿', '评估', '损害', '量化'],
    icon: <DashboardOutlined />,
    difficulty: 'advanced',
    usageCount: 520,
    favorite: false,
  },
  {
    id: 'insp-9',
    title: '空气质量改善方案',
    description: '基于污染源解析结果，提出精准治污方案',
    prompt: '基于 PM2.5 源解析结果（工业源 35%、机动车 28%、扬尘 20%、其他 17%），请制定分季节、分区域的精准治污方案，量化各项措施的减排效果和投资需求。',
    category: 'monitoring',
    tags: ['PM2.5', '源解析', '治污', '减排'],
    icon: <CompassOutlined />,
    difficulty: 'medium',
    usageCount: 1450,
    favorite: true,
  },
  {
    id: 'insp-10',
    title: '排污许可证审核',
    description: '对企业提交的排污许可证申请材料进行技术审核',
    prompt: '请审核该企业排污许可证申请表：核对排污口设置合理性、许可排放量计算的准确性、自行监测方案的完整性，并出具技术审核意见。',
    category: 'compliance',
    tags: ['排污许可', '审核', '许可证', '技术'],
    icon: <FileTextOutlined />,
    difficulty: 'easy',
    usageCount: 2100,
    favorite: false,
  },
];

// ─── 分类配置 ───

const CATEGORY_CONFIG: Record<InspirationCategory, { label: string; icon: React.ReactNode; color: string }> = {
  monitoring: { label: '环境监测', icon: <GlobalOutlined />, color: '#1677ff' },
  enforcement: { label: '执法监察', icon: <SafetyOutlined />, color: '#722ed1' },
  analysis: { label: '数据分析', icon: <BarChartOutlined />, color: '#13c2c2' },
  reporting: { label: '报告生成', icon: <FileTextOutlined />, color: '#52c41a' },
  emergency: { label: '应急管理', icon: <AlertOutlined />, color: '#ff4d4f' },
  compliance: { label: '合规审查', icon: <SafetyOutlined />, color: '#fa8c16' },
};

// ─── Props ───

interface InspirationPanelProps {
  onSelectPrompt?: (prompt: string) => void;
  compact?: boolean;
}

// ─── 组件 ───

const InspirationPanel: React.FC<InspirationPanelProps> = ({
  onSelectPrompt,
  compact = false,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<InspirationCategory | 'all'>('all');
  const [favorites, setFavorites] = useState<Set<string>>(
    new Set(INSPIRATION_DATA.filter(i => i.favorite).map(i => i.id))
  );
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (item: InspirationItem) => {
    onSelectPrompt?.(item.prompt);
  };

  const filteredItems = useMemo(() => {
    let items = [...INSPIRATION_DATA];
    if (activeCategory !== 'all') {
      items = items.filter(i => i.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    // 收藏排序优先
    items.sort((a, b) => {
      const aFav = favorites.has(a.id) ? -1 : 0;
      const bFav = favorites.has(b.id) ? -1 : 0;
      return aFav - bFav || b.usageCount - a.usageCount;
    });
    return items;
  }, [search, activeCategory, favorites]);

  const difficultyTag = (d: InspirationItem['difficulty']) => {
    switch (d) {
      case 'easy': return <Tag color="green" style={{ fontSize: 10 }}>简单</Tag>;
      case 'medium': return <Tag color="orange" style={{ fontSize: 10 }}>中等</Tag>;
      case 'advanced': return <Tag color="red" style={{ fontSize: 10 }}>高阶</Tag>;
    }
  };

  const renderItem = (item: InspirationItem) => (
    <Card
      key={item.id}
      size="small"
      hoverable
      style={{ borderRadius: 8, marginBottom: 8 }}
      onClick={() => handleSelect(item)}
    >
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: `${CATEGORY_CONFIG[item.category].color}15`,
          color: CATEGORY_CONFIG[item.category].color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {item.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
            <Space size={2}>
              <Button
                type="text"
                size="small"
                icon={favorites.has(item.id) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                onClick={e => { e.stopPropagation(); toggleFavorite(item.id); }}
              />
              <Button
                type="text"
                size="small"
                icon={<SendOutlined />}
                onClick={e => { e.stopPropagation(); handleSelect(item); }}
              />
            </Space>
          </div>
          <Paragraph
            type="secondary"
            ellipsis={{ rows: 2 }}
            style={{ fontSize: 11, margin: '4px 0' }}
          >
            {item.description}
          </Paragraph>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Tag color={CATEGORY_CONFIG[item.category].color} style={{ fontSize: 10 }}>
              {CATEGORY_CONFIG[item.category].label}
            </Tag>
            {difficultyTag(item.difficulty)}
            {item.tags.slice(0, 2).map(tag => (
              <Tag key={tag} style={{ fontSize: 10 }}>{tag}</Tag>
            ))}
            <Text type="secondary" style={{ fontSize: 10 }}>
              {item.usageCount.toLocaleString()} 次使用
            </Text>
          </div>
        </div>
      </div>
    </Card>
  );

  if (compact) {
    return (
      <div>
        <div style={{ marginBottom: 8, display: 'flex', gap: 4, alignItems: 'center' }}>
          <Input
            size="small"
            placeholder="搜索灵感..."
            prefix={<BulbOutlined />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{ flex: 1 }}
          />
          <Tooltip title="刷新">
            <Button size="small" icon={<ReloadOutlined />} onClick={handleRefresh} loading={refreshing} />
          </Tooltip>
        </div>
        <div style={{ maxHeight: 400, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filteredItems.slice(0, 6).map(renderItem)}
        </div>
      </div>
    );
  }

  const categoryTabs = [
    { key: 'all', label: <Space size={2}><FireOutlined />全部</Space> },
    ...Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => ({
      key,
      label: <Space size={2}>{cfg.icon}{cfg.label}</Space>,
    })),
  ];

  return (
    <div className="p-4" style={{ height: '100%', overflow: 'auto' }}>
      {/* 头部 */}
      <div style={{ marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          <BulbOutlined /> 灵感推荐
        </Title>
        <Text type="secondary">基于场景的智能提示推荐，点击即可使用</Text>
      </div>

      {/* 搜索 */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <Input
          placeholder="搜索灵感提示..."
          prefix={<BulbOutlined />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          style={{ flex: 1 }}
        />
        <Tooltip title="刷新推荐">
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={refreshing} />
        </Tooltip>
      </div>

      {/* 分类标签 */}
      <div style={{ marginBottom: 16 }}>
        <Tabs
          size="small"
          activeKey={activeCategory}
          onChange={key => setActiveCategory(key as InspirationCategory | 'all')}
          items={categoryTabs.map(cat => ({
            key: cat.key,
            label: cat.label,
          }))}
        />
      </div>

      {/* 灵感列表 */}
      {filteredItems.length > 0 ? (
        <List
          dataSource={filteredItems}
          renderItem={renderItem}
        />
      ) : (
        <Empty description="未找到匹配的灵感提示" />
      )}
    </div>
  );
};

export default InspirationPanel;
