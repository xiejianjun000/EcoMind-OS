/**
 * Skills 技能集市 — 生态环境专业能力清单
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tag, Button, Input, Typography, Row, Col, Space, Tooltip, Empty } from 'antd';
import {
  SearchOutlined, ThunderboltOutlined, ExperimentOutlined,
  GlobalOutlined, ScanOutlined, HeatMapOutlined,
  CheckCircleOutlined, FileTextOutlined, EyeOutlined,
  BarChartOutlined, NodeIndexOutlined,
} from '@ant-design/icons';
import { useExpertStore, useChatStore } from '@/store';

const { Title, Text } = Typography;

// 图标映射
const iconMap: Record<string, React.ReactNode> = {
  GlobalOutlined: <GlobalOutlined />,
  ScanOutlined: <ScanOutlined />,
  HeatMapOutlined: <HeatMapOutlined />,
  CheckCircleOutlined: <CheckCircleOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  EyeOutlined: <EyeOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  NodeIndexOutlined: <NodeIndexOutlined />,
};

// 技能分类
const skillCategories = [
  { key: 'visualization', label: '可视化', color: '#1890ff' },
  { key: 'analysis', label: '分析', color: '#722ed1' },
  { key: 'compliance', label: '合规', color: '#f5222d' },
  { key: 'generation', label: '生成', color: '#52c41a' },
  { key: 'recognition', label: '识别', color: '#fa8c16' },
];

const SkillsPage: React.FC = () => {
  const navigate = useNavigate();
  const { skills, experts } = useExpertStore();
  const { createSession } = useChatStore();
  const [searchText, setSearchText] = useState('');

  const filteredSkills = useMemo(() => {
    if (!searchText.trim()) return skills;
    const kw = searchText.trim().toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        s.description.toLowerCase().includes(kw)
    );
  }, [skills, searchText]);

  const handleUseSkill = (skillId: string, skillName: string) => {
    const sessionId = createSession({
      title: `使用技能：${skillName}`,
      expertId: 'gaia',
    });
    navigate(`/chat/${sessionId}`);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ThunderboltOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
            技能集市
          </Title>
          <Text type="secondary">8 项专业生态环境分析能力，随时调用</Text>
        </div>
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索技能..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 260 }}
          allowClear
        />
      </div>

      <Row gutter={[16, 16]}>
        {filteredSkills.map((skill) => {
          const skillExperts = experts.filter((e) => skill.expertIds.includes(e.id));
          return (
            <Col xs={24} sm={12} lg={8} xl={6} key={skill.id}>
              <Card
                hoverable
                className="h-full transition-all duration-200 hover:shadow-md"
                bodyStyle={{ padding: 16 }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: '#fa8c1620', color: '#fa8c16' }}
                  >
                    {iconMap[skill.icon] ?? <ExperimentOutlined />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base">{skill.name}</div>
                    <Text type="secondary" className="text-xs">
                      {skill.description}
                    </Text>
                  </div>
                </div>

                <div className="mb-3">
                  <Text type="secondary" className="text-xs block mb-1">
                    可用专家：
                  </Text>
                  <div className="flex flex-wrap gap-1">
                    {skillExperts.slice(0, 4).map((e) => (
                      <Tag key={e.id} color={e.color} style={{ margin: 0, fontSize: 11 }}>
                        {e.displayName}
                      </Tag>
                    ))}
                    {skillExperts.length > 4 && (
                      <Tooltip title={skillExperts.slice(4).map((e) => e.displayName).join('、')}>
                        <Tag style={{ margin: 0, fontSize: 11 }}>+{skillExperts.length - 4}</Tag>
                      </Tooltip>
                    )}
                  </div>
                </div>

                <Button
                  type="primary"
                  block
                  icon={<ThunderboltOutlined />}
                  onClick={() => handleUseSkill(skill.id, skill.name)}
                  style={{ backgroundColor: '#fa8c16', borderColor: '#fa8c16' }}
                >
                  使用技能
                </Button>
              </Card>
            </Col>
          );
        })}
      </Row>

      {filteredSkills.length === 0 && <Empty description="未找到匹配的技能" />}
    </div>
  );
};

export default SkillsPage;
