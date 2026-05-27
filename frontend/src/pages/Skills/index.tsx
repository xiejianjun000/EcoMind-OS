/**
 * Skills 技能市场 — 技能浏览/安装/订阅/使用
 *
 * v6.5 新增: 技能市场 (Marketplace) Tab，支持浏览未安装技能、一键安装
 */
import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Tag, Button, Input, Typography, Row, Col, Space, Tooltip, Empty, Tabs, Badge, Statistic, message } from 'antd'
import {
  SearchOutlined, ThunderboltOutlined, ExperimentOutlined,
  GlobalOutlined, ScanOutlined, HeatMapOutlined,
  CheckCircleOutlined, FileTextOutlined, EyeOutlined,
  BarChartOutlined, NodeIndexOutlined, DownloadOutlined,
  StarOutlined, FireOutlined, AppstoreOutlined,
  CloudDownloadOutlined, PlusCircleOutlined,
} from '@ant-design/icons'
import { useExpertStore, useChatStore } from '@/store'

const { Title, Text } = Typography

// ─── 图标映射 ───
const iconMap: Record<string, React.ReactNode> = {
  GlobalOutlined: <GlobalOutlined />,
  ScanOutlined: <ScanOutlined />,
  HeatMapOutlined: <HeatMapOutlined />,
  CheckCircleOutlined: <CheckCircleOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  EyeOutlined: <EyeOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  NodeIndexOutlined: <NodeIndexOutlined />,
}

// ─── 技能市场数据 (未安装) ───
interface MarketSkill {
  id: string
  name: string
  description: string
  icon: string
  category: string
  author: string
  downloads: number
  rating: number
  version: string
  expertIds: string[]
  tags: string[]
}

const MARKETPLACE_SKILLS: MarketSkill[] = [
  { id: 'skill-satellite', name: '卫星遥感分析', description: '基于 Sentinel-2/Landsat 卫星影像的生态环境变化检测', icon: 'GlobalOutlined', category: 'analysis', author: '生态环境部卫星中心', downloads: 2340, rating: 4.8, version: 'v2.3.1', expertIds: ['env-monitoring', 'gaia'], tags: ['遥感', 'AI', '变化检测'] },
  { id: 'skill-drone', name: '无人机巡查路径规划', description: '自动生成无人机生态环境巡查最优飞行路径和拍摄点', icon: 'ScanOutlined', category: 'analysis', author: 'EcoMind Lab', downloads: 1890, rating: 4.6, version: 'v1.8.0', expertIds: ['enforcement', 'env-monitoring'], tags: ['无人机', '路径规划', '巡查'] },
  { id: 'skill-carbon-accounting', name: '碳排放核算引擎', description: '基于 IPCC 方法学的企业/园区/城市碳排放自动核算', icon: 'HeatMapOutlined', category: 'analysis', author: '碳达峰研究院', downloads: 3200, rating: 4.9, version: 'v3.0.1', expertIds: ['emission-trading', 'gaia'], tags: ['碳排放', '核算', 'IPCC'] },
  { id: 'skill-water-model', name: '水环境模型推演', description: '基于 SWAT/MIKE 的水质水量耦合模拟与情景预测', icon: 'BarChartOutlined', category: 'analysis', author: '水生态环境处', downloads: 1560, rating: 4.5, version: 'v2.1.0', expertIds: ['water-ecology', 'env-monitoring'], tags: ['水质', '模型', '预测'] },
  { id: 'skill-noise-map', name: '噪声热力图生成', description: '基于监测站点/移动监测数据的城市噪声热力图自动生成', icon: 'HeatMapOutlined', category: 'visualization', author: '监测处', downloads: 980, rating: 4.3, version: 'v1.5.2', expertIds: ['env-monitoring'], tags: ['噪声', '热力图', 'GIS'] },
  { id: 'skill-doc-ocr', name: '执法文书 OCR 识别', description: '手写/扫描执法文书的 OCR 识别与结构化信息提取', icon: 'FileTextOutlined', category: 'recognition', author: '执法局', downloads: 2750, rating: 4.7, version: 'v2.4.0', expertIds: ['enforcement'], tags: ['OCR', '文书', '执法'] },
  { id: 'skill-biodiv-identify', name: '生物多样性 AI 鉴定', description: '基于图像/声音的动植物物种自动识别与生物多样性评估', icon: 'EyeOutlined', category: 'recognition', author: '生态研究所', downloads: 1680, rating: 4.4, version: 'v1.9.1', expertIds: ['biodiversity'], tags: ['生物多样性', 'AI识别', '生态'] },
  { id: 'skill-report-gen', name: '智能报告生成器', description: '基于模板和数据自动生成监测日报/执法周报/环评报告', icon: 'FileTextOutlined', category: 'generation', author: 'EcoMind Lab', downloads: 4100, rating: 4.8, version: 'v3.2.0', expertIds: ['gaia', 'eia', 'env-monitoring'], tags: ['报告', '自动生成', '模板'] },
  { id: 'skill-emergency-dispersion', name: '突发污染扩散模拟', description: '危化品泄漏/大气污染突发事件的实时扩散模拟与应急响应', icon: 'NodeIndexOutlined', category: 'analysis', author: '应急管理中心', downloads: 1250, rating: 4.6, version: 'v2.0.3', expertIds: ['emergency-response'], tags: ['应急', '扩散', '模拟'] },
  { id: 'skill-gis-overlay', name: 'GIS 多图层叠加分析', description: '生态红线/保护区/排污口/监测站等多源 GIS 图层叠加分析', icon: 'GlobalOutlined', category: 'visualization', author: 'GIS中心', downloads: 2100, rating: 4.5, version: 'v2.2.0', expertIds: ['gaia', 'env-monitoring'], tags: ['GIS', '图层', '叠加分析'] },
  { id: 'skill-law-search', name: '法规智能检索', description: '生态环境法律法规语义检索、条款匹配与历史案例关联', icon: 'CheckCircleOutlined', category: 'compliance', author: '法规处', downloads: 3500, rating: 4.9, version: 'v3.1.0', expertIds: ['gaia', 'enforcement', 'eia'], tags: ['法规', '检索', '案例'] },
  { id: 'skill-data-quality', name: '监测数据质量审计', description: '自动检测监测数据异常值、缺失值、逻辑矛盾并生成质量报告', icon: 'ScanOutlined', category: 'compliance', author: '监测处', downloads: 1450, rating: 4.4, version: 'v1.7.0', expertIds: ['env-monitoring'], tags: ['数据质量', '审计', '异常检测'] },
]

const MARKET_CATEGORIES = [
  { key: 'all', label: '全部', color: '#6B7280' },
  { key: 'analysis', label: '分析', color: '#722ed1' },
  { key: 'visualization', label: '可视化', color: '#1890ff' },
  { key: 'compliance', label: '合规', color: '#f5222d' },
  { key: 'generation', label: '生成', color: '#52c41a' },
  { key: 'recognition', label: '识别', color: '#fa8c16' },
]

const SkillsPage: React.FC = () => {
  const navigate = useNavigate()
  const { skills, experts } = useExpertStore()
  const { createSession } = useChatStore()
  const [searchText, setSearchText] = useState('')
  const [activeTab, setActiveTab] = useState('installed')
  const [marketCategory, setMarketCategory] = useState('all')
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set(skills.map(s => s.id)))
  const [installing, setInstalling] = useState<string | null>(null)

  // ─── 已安装技能过滤 ───
  const filteredInstalled = useMemo(() => {
    if (!searchText.trim()) return skills
    const kw = searchText.trim().toLowerCase()
    return skills.filter(s => s.name.toLowerCase().includes(kw) || s.description.toLowerCase().includes(kw))
  }, [skills, searchText])

  // ─── 市场技能过滤 ───
  const filteredMarket = useMemo(() => {
    let list = MARKETPLACE_SKILLS.filter(s => !installedIds.has(s.id))
    if (marketCategory !== 'all') list = list.filter(s => s.category === marketCategory)
    if (searchText.trim()) {
      const kw = searchText.trim().toLowerCase()
      list = list.filter(s => s.name.toLowerCase().includes(kw) || s.description.toLowerCase().includes(kw) || s.tags.some(t => t.includes(kw)))
    }
    // Sort by downloads desc
    list.sort((a, b) => b.downloads - a.downloads)
    return list
  }, [marketCategory, searchText, installedIds])

  // ─── 热门技能 (Top 3) ───
  const trendingSkills = useMemo(() =>
    MARKETPLACE_SKILLS.filter(s => !installedIds.has(s.id)).sort((a, b) => b.downloads - a.downloads).slice(0, 3),
    [installedIds]
  )

  const handleUseSkill = (skillId: string, skillName: string) => {
    const sessionId = createSession({ title: `使用技能：${skillName}`, expertId: 'gaia' })
    navigate(`/chat/${sessionId}`)
  }

  const handleInstall = (skill: MarketSkill) => {
    setInstalling(skill.id)
    setTimeout(() => {
      setInstalledIds(prev => new Set([...prev, skill.id]))
      setInstalling(null)
      message.success(`技能「${skill.name}」安装成功！`)
    }, 800)
  }

  const installedCount = skills.length
  const marketCount = MARKETPLACE_SKILLS.filter(s => !installedIds.has(s.id)).length

  // ─── 渲染技能卡片 ───
  const renderSkillCard = (skill: any, isMarket: boolean = false) => {
    const skillExperts = experts.filter((e: any) => skill.expertIds?.includes(e.id))
    return (
      <Col xs={24} sm={12} lg={8} xl={6} key={skill.id}>
        <Card hoverable className="h-full transition-all duration-200 hover:shadow-md" bodyStyle={{ padding: 16 }}>
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: isMarket ? '#722ed120' : '#fa8c1620', color: isMarket ? '#722ed1' : '#fa8c16' }}>
              {iconMap[skill.icon] ?? <ExperimentOutlined />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base flex items-center gap-2">
                {skill.name}
                {isMarket && skill.rating >= 4.8 && <StarOutlined className="text-xs" style={{ color: '#faad14' }} />}
              </div>
              <Text type="secondary" className="text-xs">{skill.description}</Text>
            </div>
          </div>

          {/* Market Meta */}
          {isMarket && (
            <div className="flex flex-wrap gap-2 mb-3">
              {skill.tags?.map((tag: string) => <Tag key={tag} className="text-xs" style={{ margin: 0 }}>{tag}</Tag>)}
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
            {isMarket ? (
              <>
                <span><CloudDownloadOutlined /> {skill.downloads?.toLocaleString()}</span>
                <span><StarOutlined style={{ color: '#faad14' }} /> {skill.rating}</span>
                <span className="ml-auto">{skill.version}</span>
              </>
            ) : (
              <>
                <Text type="secondary" className="text-xs">可用专家：</Text>
                <div className="flex flex-wrap gap-1 flex-1">
                  {skillExperts.slice(0, 3).map((e: any) => (
                    <Tag key={e.id} color={e.color} style={{ margin: 0, fontSize: 11 }}>{e.displayName}</Tag>
                  ))}
                  {skillExperts.length > 3 && <Tag style={{ margin: 0, fontSize: 11 }}>+{skillExperts.length - 3}</Tag>}
                </div>
              </>
            )}
          </div>

          {/* Action Button */}
          {isMarket ? (
            <Button type="default" block icon={<DownloadOutlined />}
              loading={installing === skill.id}
              onClick={() => handleInstall(skill)}
              style={{ borderColor: '#722ed1', color: '#722ed1' }}>
              安装技能
            </Button>
          ) : (
            <Button type="primary" block icon={<ThunderboltOutlined />}
              onClick={() => handleUseSkill(skill.id, skill.name)}
              style={{ backgroundColor: '#fa8c16', borderColor: '#fa8c16' }}>
              使用技能
            </Button>
          )}
        </Card>
      </Col>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <AppstoreOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
            技能市场
          </Title>
          <Text type="secondary">已安装 {installedCount} 项 · 市场 {marketCount} 项可安装</Text>
        </div>
        <Input prefix={<SearchOutlined />} placeholder="搜索技能、标签..." value={searchText}
          onChange={e => setSearchText(e.target.value)} style={{ width: 260 }} allowClear />
      </div>

      {/* Trending Bar */}
      {activeTab === 'market' && trendingSkills.length > 0 && searchText === '' && marketCategory === 'all' && (
        <Card size="small" className="bg-gradient-to-r from-orange-50 to-purple-50 border-0">
          <div className="flex items-center gap-2 mb-2">
            <FireOutlined style={{ color: '#f5222d' }} />
            <Text strong>热门技能</Text>
          </div>
          <div className="flex gap-3 flex-wrap">
            {trendingSkills.map(s => (
              <Tag key={s.id} color="orange" className="cursor-pointer px-3 py-1" onClick={() => { setSearchText(s.name); setMarketCategory(s.category) }}>
                🔥 {s.name} · {s.downloads.toLocaleString()} 次安装
              </Tag>
            ))}
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}
        items={[
          {
            key: 'installed',
            label: <span><CheckCircleOutlined /> 已安装 ({installedCount})</span>,
            children: (
              <div>
                {filteredInstalled.length === 0 ? (
                  <Empty description="未找到匹配的技能" />
                ) : (
                  <Row gutter={[16, 16]}>
                    {filteredInstalled.map(s => renderSkillCard(s, false))}
                  </Row>
                )}
              </div>
            ),
          },
          {
            key: 'market',
            label: <span><AppstoreOutlined /> 技能市场 ({marketCount})</span>,
            children: (
              <div className="space-y-4">
                {/* Category Filter */}
                <div className="flex flex-wrap gap-2">
                  {MARKET_CATEGORIES.map(cat => (
                    <Tag key={cat.key}
                      color={marketCategory === cat.key ? cat.color : undefined}
                      className="cursor-pointer px-3 py-1"
                      onClick={() => setMarketCategory(cat.key)}>
                      {cat.label}
                    </Tag>
                  ))}
                </div>
                {filteredMarket.length === 0 ? (
                  <Empty description="未找到可安装的技能" />
                ) : (
                  <Row gutter={[16, 16]}>
                    {filteredMarket.map(s => renderSkillCard(s, true))}
                  </Row>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

export default SkillsPage
