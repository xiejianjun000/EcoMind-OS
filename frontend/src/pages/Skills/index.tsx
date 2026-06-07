/**
 * Skills 技能市场 — 浏览/安装/卸载技能
 *
 * 从后端 API 获取技能列表，支持按智能体安装/卸载。
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Card, Tag, Button, Input, Typography, Row, Col, Space, Tooltip, Empty,
  Tabs, Badge, message, Select, Spin, Progress,
} from 'antd'
import {
  SearchOutlined, ThunderboltOutlined, ExperimentOutlined,
  GlobalOutlined, ScanOutlined, HeatMapOutlined,
  CheckCircleOutlined, FileTextOutlined, EyeOutlined,
  BarChartOutlined, NodeIndexOutlined, DownloadOutlined,
  StarOutlined, CloudDownloadOutlined, ApiOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
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

const categoryIcon: Record<string, React.ReactNode> = {
  analysis: <BarChartOutlined />,
  visualization: <HeatMapOutlined />,
  compliance: <CheckCircleOutlined />,
  generation: <FileTextOutlined />,
  recognition: <EyeOutlined />,
}

const CATEGORIES = [
  { key: 'all', label: '全部', color: '#6B7280' },
  { key: 'analysis', label: '分析', color: '#722ed1' },
  { key: 'visualization', label: '可视化', color: '#1890ff' },
  { key: 'compliance', label: '合规', color: '#f5222d' },
  { key: 'generation', label: '生成', color: '#52c41a' },
  { key: 'recognition', label: '识别', color: '#fa8c16' },
]

interface SkillItem {
  id: string
  name: string
  description: string
  category: string
  author: string
  downloads: number
  rating: number
  version: string
  expert_ids: string[]
  tags: string[]
  safety_level: string
  handler?: string
  installed_agents?: string[]
}

const SkillsPage: React.FC = () => {
  const navigate = useNavigate()
  const { experts } = useExpertStore()
  const { createSession } = useChatStore()

  const [allSkills, setAllSkills] = useState<SkillItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [marketCategory, setMarketCategory] = useState('all')
  const [installing, setInstalling] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string>('')

  // 安装状态 { skillId: [agentId, ...] }
  const [skillAgents, setSkillAgents] = useState<Record<string, string[]>>({})

  // ─── 加载技能列表 ───
  const fetchSkills = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, myRes] = await Promise.all([
        fetch('/api/skills/list').then(r => r.json()),
        fetch('/api/skills/my').then(r => r.json()),
      ])

      const skills: SkillItem[] = (listRes.skills || []).map((s: any) => ({
        ...s,
        expert_ids: s.expert_ids || [],
      }))
      setAllSkills(skills)

      // 构建安装状态
      const agents: Record<string, string[]> = {}
      if (myRes.skills) {
        for (const s of myRes.skills) {
          agents[s.id] = s.agent_ids || []
        }
      }
      setSkillAgents(agents)
    } catch (e) {
      console.warn('Failed to load skills', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSkills() }, [fetchSkills])

  // ─── 过滤 ───
  const filteredSkills = useMemo(() => {
    let list = allSkills

    // Tab: installed / market / all
    if (activeTab === 'installed') {
      list = list.filter(s => (skillAgents[s.id]?.length || 0) > 0)
    } else if (activeTab === 'market') {
      list = list.filter(s => !skillAgents[s.id] || skillAgents[s.id].length === 0)
    }

    // Agent filter
    if (selectedAgent) {
      list = list.filter(s => s.expert_ids?.includes(selectedAgent))
    }

    // Category
    if (marketCategory !== 'all') {
      list = list.filter(s => s.category === marketCategory)
    }

    // Search
    if (searchText.trim()) {
      const kw = searchText.trim().toLowerCase()
      list = list.filter(s =>
        s.name.toLowerCase().includes(kw) ||
        s.description.toLowerCase().includes(kw) ||
        s.tags?.some((t: string) => t.toLowerCase().includes(kw))
      )
    }

    // Sort: installed first, then by downloads
    list.sort((a, b) => {
      const aInst = skillAgents[a.id]?.length || 0
      const bInst = skillAgents[b.id]?.length || 0
      if (aInst !== bInst) return bInst - aInst
      return (b.downloads || 0) - (a.downloads || 0)
    })

    return list
  }, [allSkills, activeTab, marketCategory, searchText, selectedAgent, skillAgents])

  const installedCount = Object.values(skillAgents).filter(a => a.length > 0).length
  const marketCount = allSkills.length - installedCount

  // ─── 操作 ───
  const handleInstall = async (skill: SkillItem, agentId = '') => {
    setInstalling(skill.id)
    try {
      const body: any = { skill_id: skill.id }
      if (agentId) body.agent_id = agentId

      const r = await fetch('/api/skills/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (r.ok) {
        const newAgents = data.installed_to || []
        setSkillAgents(prev => ({
          ...prev,
          [skill.id]: [...new Set([...(prev[skill.id] || []), ...newAgents])],
        }))
        message.success(data.message || `「${skill.name}」安装成功`)
      } else {
        message.error(data.detail || '安装失败')
      }
    } catch {
      message.error('安装失败，请稍后重试')
    } finally {
      setInstalling(null)
    }
  }

  const handleUninstall = async (skill: SkillItem, agentId = '') => {
    try {
      const params = agentId ? `?agent_id=${agentId}` : ''
      const r = await fetch(`/api/skills/uninstall?skill_id=${skill.id}${params}`, { method: 'POST' })
      const data = await r.json()
      if (r.ok) {
        setSkillAgents(prev => {
          if (agentId) {
            return { ...prev, [skill.id]: (prev[skill.id] || []).filter(a => a !== agentId) }
          }
          const copy = { ...prev }
          delete copy[skill.id]
          return copy
        })
        message.success(`「${skill.name}」已卸载`)
      } else {
        message.error(data.detail || '卸载失败')
      }
    } catch {
      message.error('卸载失败')
    }
  }

  const handleUseSkill = (skillId: string, skillName: string) => {
    const sessionId = createSession({ title: `使用技能：${skillName}`, expertId: 'ecomind' })
    navigate(`/chat/${sessionId}`)
  }

  // ─── 渲染卡片 ───
  const renderCard = (skill: SkillItem) => {
    const isInstalled = (skillAgents[skill.id]?.length || 0) > 0
    const boundAgents = (skillAgents[skill.id] || [])
    const agentObjects = experts.filter((e: any) => skill.expert_ids?.includes(e.id))
    const boundAgentObjects = experts.filter((e: any) => boundAgents.includes(e.id))

    return (
      <Col xs={24} sm={12} lg={8} xl={6} key={skill.id}>
        <Card hoverable className="h-full transition-all duration-200 hover:shadow-md"
          bodyStyle={{ padding: 16 }}>
          {/* Header */}
          <div className="flex items-start gap-3 mb-2">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl"
              style={{
                backgroundColor: isInstalled ? '#52c41a20' : '#722ed120',
                color: isInstalled ? '#52c41a' : '#722ed1',
              }}>
              {categoryIcon[skill.category] ?? <ExperimentOutlined />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base flex items-center gap-2">
                {skill.name}
                {skill.rating >= 4.8 && <StarOutlined className="text-xs" style={{ color: '#faad14' }} />}
              </div>
              <Text type="secondary" className="text-xs line-clamp-2">{skill.description}</Text>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-2">
            {skill.tags?.slice(0, 3).map((tag: string) => (
              <Tag key={tag} className="text-xs" style={{ margin: 0 }}>{tag}</Tag>
            ))}
            <Tag color={isInstalled ? 'green' : 'default'} className="text-xs ml-auto" style={{ margin: 0 }}>
              {isInstalled ? `已安装(${boundAgents.length}智能体)` : '未安装'}
            </Tag>
          </div>

          {/* Compatible agents */}
          {agentObjects.length > 0 && (
            <div className="mb-2">
              <Text type="secondary" className="text-xs">兼容: </Text>
              {agentObjects.slice(0, 3).map((e: any) => (
                <Tag key={e.id} color={boundAgents.includes(e.id) ? 'green' : 'default'}
                  style={{ margin: '0 2px', fontSize: 11 }}>
                  {e.displayName || e.id}
                </Tag>
              ))}
              {agentObjects.length > 3 && <Tag style={{ margin: '0 2px', fontSize: 11 }}>+{agentObjects.length - 3}</Tag>}
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
            <span><CloudDownloadOutlined /> {(skill.downloads || 0).toLocaleString()}</span>
            <span><StarOutlined style={{ color: '#faad14' }} /> {skill.rating}</span>
            <Tooltip title={skill.author}>
              <span className="ml-auto truncate max-w-[100px]">{skill.version}</span>
            </Tooltip>
          </div>

          {/* Actions */}
          <Space direction="vertical" className="w-full" size={4}>
            {!isInstalled ? (
              <Button type="default" block icon={<DownloadOutlined />}
                loading={installing === skill.id}
                onClick={() => handleInstall(skill)}
                style={{ borderColor: '#722ed1', color: '#722ed1' }}>
                安装到全部兼容智能体
              </Button>
            ) : (
              <>
                <Button type="primary" block icon={<ThunderboltOutlined />}
                  onClick={() => handleUseSkill(skill.id, skill.name)}
                  style={{ backgroundColor: '#fa8c16', borderColor: '#fa8c16' }}>
                  使用技能
                </Button>
                <Space className="w-full" size={4}>
                  <Select size="small" className="flex-1" placeholder="安装到指定智能体"
                    options={agentObjects.filter((e: any) => !boundAgents.includes(e.id)).map((e: any) => ({
                      value: e.id, label: e.displayName || e.id,
                    }))}
                    disabled={agentObjects.filter((e: any) => !boundAgents.includes(e.id)).length === 0}
                    onChange={(val) => handleInstall(skill, val)}
                  />
                  <Tooltip title="从全部智能体卸载">
                    <Button size="small" danger icon={<DeleteOutlined />}
                      onClick={() => handleUninstall(skill)} />
                  </Tooltip>
                </Space>
              </>
            )}
          </Space>
        </Card>
      </Col>
    )
  }

  // ─── 主渲染 ───
  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Title */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <Title level={4} className="mb-1">技能模块</Title>
          <Text type="secondary">
            共 {allSkills.length} 个技能 · 已安装 {installedCount} 个 · 可安装 {marketCount} 个
          </Text>
        </div>
        <Button icon={<ApiOutlined />} onClick={fetchSkills}>刷新</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input prefix={<SearchOutlined />} placeholder="搜索技能名称/描述/标签..."
          className="w-64" allowClear
          value={searchText} onChange={e => setSearchText(e.target.value)} />

        <Select placeholder="按智能体筛选" allowClear className="w-40"
          value={selectedAgent || undefined}
          onChange={(v) => setSelectedAgent(v || '')}
          options={experts.map((e: any) => ({ value: e.id, label: e.displayName || e.id }))} />

        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(c => (
            <Tag key={c.key} color={marketCategory === c.key ? c.color : undefined}
              className="cursor-pointer"
              onClick={() => setMarketCategory(c.key)}>
              {c.label}
            </Tag>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}
        items={[
          { key: 'all', label: <Badge count={allSkills.length} overflowCount={99}>全部技能</Badge> },
          { key: 'installed', label: <Badge count={installedCount} overflowCount={99}>已安装</Badge> },
          { key: 'market', label: <Badge count={marketCount} overflowCount={99}>可安装</Badge> },
        ]}
        className="mb-4"
      />

      {/* Grid */}
      {filteredSkills.length === 0 ? (
        <Empty description="没有匹配的技能" />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredSkills.map(renderCard)}
        </Row>
      )}
    </div>
  )
}

export default SkillsPage
