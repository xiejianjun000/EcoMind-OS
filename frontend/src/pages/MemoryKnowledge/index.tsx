import React from 'react';
import { Row, Col, Card, Typography, List, Tag, Space, Input, Tree } from 'antd';
import { BranchesOutlined, DatabaseOutlined, SearchOutlined, NodeIndexOutlined } from '@ant-design/icons';
import PageHeader from '@/components/PageHeader';

const { Title, Text } = Typography;

const KNOWLEDGE_TREE = [
  { title: '🌍 环境法规知识图谱', key: 'laws', children: [
    { title: '《环境保护法》', key: 'law-1', children: [
      { title: '第6条 地方职责', key: 'law-1-6' },
      { title: '第25条 查封扣押', key: 'law-1-25' },
      { title: '第59条 按日计罚', key: 'law-1-59' },
    ]},
    { title: '《大气污染防治法》', key: 'law-2' },
    { title: '《水污染防治法》', key: 'law-3' },
    { title: '《环境影响评价法》', key: 'law-4' },
    { title: '《排污许可管理条例》', key: 'law-5' },
  ]},
  { title: '🤖 Agent 调用链', key: 'agents', children: [
    { title: '执法办案智能体 → search_regulation → 《大气污染防治法》第99条', key: 'chain-1' },
    { title: '监测分析智能体 → query_environment_data → 长沙PM2.5', key: 'chain-2' },
    { title: '环评审批智能体 → submit_approval → 排污许可', key: 'chain-3' },
  ]},
];

const MEMORY_SESSIONS = [
  { id: '1', title: '长沙空气质量分析', summary: '用户要求分析2026年5月长沙PM2.5变化趋势，关注岳麓区监测站数据...', time: '2026-05-26 14:30', tags: ['空气', '长沙', 'PM2.5'] },
  { id: '2', title: '执法案件咨询', summary: '咨询污水超标排放的执法依据和处罚标准，关注《水污染防治法》第83条...', time: '2026-05-26 11:15', tags: ['执法', '污水', '法规'] },
  { id: '3', title: '碳排放核算', summary: '核算2025年度全省六大高耗能行业碳排放总量，对标碳达峰目标...', time: '2026-05-25 16:00', tags: ['碳排放', '碳达峰', '核算'] },
  { id: '4', title: '洞庭湖生态评估', summary: '评估洞庭湖湿地生态修复进展，关注中华秋沙鸭越冬种群数量变化...', time: '2026-05-24 09:30', tags: ['洞庭湖', '生态', '湿地'] },
];

const MemoryKnowledge: React.FC = () => {
  return (
    <div>
      <PageHeader
        title="记忆与知识"
        icon={<DatabaseOutlined style={{ color: '#0E7490' }} />}
        breadcrumbs={[{ title: '智能体管理', path: '/' }, { title: '记忆与知识' }]}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card size="small" title={<><BranchesOutlined style={{ color: '#8B5CF6' }} /> 知识图谱</>} bodyStyle={{ padding: 12, maxHeight: 420, overflow: 'auto' }}>
            <Tree
              treeData={KNOWLEDGE_TREE}
              defaultExpandAll
              style={{ fontSize: 13 }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            size="small"
            title={<><NodeIndexOutlined style={{ color: '#3B82F6' }} /> 持久化记忆 (Claude-Mem)</>}
            bodyStyle={{ padding: 12, maxHeight: 420, overflow: 'auto' }}
            extra={<Input prefix={<SearchOutlined />} placeholder="搜索记忆..." size="small" style={{ width: 160 }} />}
          >
            {MEMORY_SESSIONS.map((session) => (
              <div key={session.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text strong style={{ fontSize: 13 }}>{session.title}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{session.time}</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  {session.summary}
                </Text>
                <div style={{ marginTop: 4 }}>
                  {session.tags.map(tag => <Tag key={tag} size="small" color="blue">{tag}</Tag>)}
                </div>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MemoryKnowledge;
