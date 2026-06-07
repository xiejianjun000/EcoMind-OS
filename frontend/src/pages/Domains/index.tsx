/**
 * 业务域配置页面 — 12 业务域知识预加载与 RAG
 * 纯前端静态数据，不调用后端 API
 */
import React, { useState } from 'react';
import { Row, Col, Card, Tag, Typography } from 'antd';
import {
  EnvironmentOutlined,
  MedicineBoxOutlined,
  AlertOutlined,
  FileSearchOutlined,
  SafetyCertificateOutlined,
  BugOutlined,
  SecurityScanOutlined,
  AuditOutlined,
  BankOutlined,
  CloudOutlined,
  TeamOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import DomainDetailDrawer, { type DomainInfo } from './components/DomainDetailDrawer';

const { Title, Text, Paragraph } = Typography;

/** 12 大业务域静态数据 */
const domainsData: DomainInfo[] = [
  {
    id: 'env-monitoring',
    name: '环境监测',
    description: '水质、大气、土壤等环境要素的实时监测与预警',
    icon: '🌍',
    coverage: 'full',
    agentCount: 3,
    workflowCount: 5,
    knowledgeBases: ['水质标准库', '大气监测规范', '土壤环境标准'],
    capabilities: ['实时数据采集', '异常预警', '趋势分析', '报告生成'],
    lastUpdated: '2026-01-15',
  },
  {
    id: 'eco-restoration',
    name: '生态修复',
    description: '受损生态系统的修复方案设计与效果评估',
    icon: '🌱',
    coverage: 'partial',
    agentCount: 2,
    workflowCount: 3,
    knowledgeBases: ['生态修复案例库', '物种数据库'],
    capabilities: ['修复方案推荐', '效果评估', '物种匹配'],
    lastUpdated: '2026-01-12',
  },
  {
    id: 'emergency',
    name: '应急管理',
    description: '突发环境事件的应急响应与处置指挥',
    icon: '🚨',
    coverage: 'full',
    agentCount: 4,
    workflowCount: 8,
    knowledgeBases: ['应急预案库', '化学品数据库', '事故案例库'],
    capabilities: ['应急响应', '资源调度', '舆情监测', '事后评估'],
    lastUpdated: '2026-01-18',
  },
  {
    id: 'eia',
    name: '环境影响评价',
    description: '建设项目的环境影响评价与审批支持',
    icon: '📋',
    coverage: 'partial',
    agentCount: 2,
    workflowCount: 4,
    knowledgeBases: ['环评法规库', '行业标准库'],
    capabilities: ['环评报告生成', '合规检查', '影响预测'],
    lastUpdated: '2026-01-10',
  },
  {
    id: 'pollution-permit',
    name: '排污许可管理',
    description: '排污许可证的申请、核发、变更与注销管理',
    icon: '🏭',
    coverage: 'full',
    agentCount: 3,
    workflowCount: 6,
    knowledgeBases: ['排污许可法规库', '排放标准库', '企业信息库'],
    capabilities: ['许可证申请审核', '排放量核算', '合规判断', '变更审批'],
    lastUpdated: '2026-01-16',
  },
  {
    id: 'biodiversity',
    name: '生物多样性保护',
    description: '物种保护、栖息地管理与生物多样性监测',
    icon: '🦋',
    coverage: 'none',
    agentCount: 0,
    workflowCount: 0,
    knowledgeBases: [],
    capabilities: [],
    lastUpdated: '—',
  },
  {
    id: 'law-enforcement',
    name: '执法监察',
    description: '环境违法行为的监测、取证与处罚执行',
    icon: '⚖️',
    coverage: 'full',
    agentCount: 4,
    workflowCount: 7,
    knowledgeBases: ['环保法规库', '处罚标准库', '案例库'],
    capabilities: ['违法检测', '智能取证', '处罚建议', '案件管理'],
    lastUpdated: '2026-01-18',
  },
  {
    id: 'eco-inspection',
    name: '生态督察',
    description: '中央及省级生态环保督察的支撑与配合',
    icon: '🔍',
    coverage: 'partial',
    agentCount: 2,
    workflowCount: 3,
    knowledgeBases: ['督察标准库', '整改案例库'],
    capabilities: ['督察线索分析', '整改跟踪', '报告生成'],
    lastUpdated: '2026-01-14',
  },
  {
    id: 'gov-approval',
    name: '政务审批合规',
    description: '政务审批流程的合规性审查与智能辅助',
    icon: '🏛️',
    coverage: 'full',
    agentCount: 3,
    workflowCount: 6,
    knowledgeBases: ['审批法规库', '流程规范库', '历史审批库'],
    capabilities: ['合规审查', '材料校验', '流程指引', '签章审批'],
    lastUpdated: '2026-01-17',
  },
  {
    id: 'carbon',
    name: '碳排放管理',
    description: '碳排放核算、交易与碳中和路径规划',
    icon: '☁️',
    coverage: 'partial',
    agentCount: 1,
    workflowCount: 2,
    knowledgeBases: ['碳交易规则库', '排放因子库'],
    capabilities: ['碳核算', '减排路径推荐', '交易建议'],
    lastUpdated: '2026-01-11',
  },
  {
    id: 'public',
    name: '公众参与/信息公开',
    description: '环境信息公开、公众投诉与意见收集处理',
    icon: '👥',
    coverage: 'partial',
    agentCount: 2,
    workflowCount: 3,
    knowledgeBases: ['信息公开法规库', '投诉案例库'],
    capabilities: ['信息发布', '投诉受理', '舆情分析', '意见反馈'],
    lastUpdated: '2026-01-13',
  },
  {
    id: 'climate',
    name: '气候变化适应',
    description: '气候变化影响评估与适应性策略制定',
    icon: '🌡️',
    coverage: 'none',
    agentCount: 0,
    workflowCount: 0,
    knowledgeBases: [],
    capabilities: [],
    lastUpdated: '—',
  },
];

const coverageConfig = {
  full: { color: 'green', label: '✅ 完整覆盖' },
  partial: { color: 'orange', label: '🔶 部分覆盖' },
  none: { color: 'red', label: '❌ 未覆盖' },
};

const DomainsPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedDomain, setSelectedDomain] = useState<DomainInfo | null>(null);

  return (
    <div className="p-6 space-y-6">
      {/* 页面头部 */}
      <div>
        <Title level={3} style={{ margin: 0 }}>
          {t('domains.title')}
        </Title>
        <Text type="secondary">{t('domains.description')}</Text>
      </div>

      {/* 统计信息 */}
      <div className="flex gap-4">
        <Tag color="green">完整覆盖 {domainsData.filter((d) => d.coverage === 'full').length}</Tag>
        <Tag color="orange">部分覆盖 {domainsData.filter((d) => d.coverage === 'partial').length}</Tag>
        <Tag color="red">未覆盖 {domainsData.filter((d) => d.coverage === 'none').length}</Tag>
      </div>

      {/* 业务域卡片网格 */}
      <Row gutter={[16, 16]}>
        {domainsData.map((domain) => {
          const coverage = coverageConfig[domain.coverage];
          return (
            <Col xs={24} sm={12} md={8} lg={6} key={domain.id}>
              <Card
                hoverable
                className="h-full cursor-pointer"
                onClick={() => setSelectedDomain(domain)}
              >
                <div className="text-center mb-3">
                  <span className="text-4xl">{domain.icon}</span>
                </div>
                <div className="text-center mb-2">
                  <Paragraph strong className="mb-0" style={{ fontSize: 16 }}>
                    {domain.name}
                  </Paragraph>
                </div>
                <Paragraph
                  type="secondary"
                  className="text-center mb-3"
                  ellipsis={{ rows: 2 }}
                  style={{ fontSize: 12, minHeight: 36 }}
                >
                  {domain.description}
                </Paragraph>
                <div className="text-center">
                  <Tag color={coverage.color}>{coverage.label}</Tag>
                </div>
                <div className="flex justify-center gap-2 mt-2 text-xs text-gray-400">
                  <span>{domain.agentCount} Agent</span>
                  <span>·</span>
                  <span>{domain.workflowCount} 工作流</span>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* 详情抽屉 */}
      <DomainDetailDrawer
        open={!!selectedDomain}
        domain={selectedDomain}
        onClose={() => setSelectedDomain(null)}
      />
    </div>
  );
};

export default DomainsPage;
