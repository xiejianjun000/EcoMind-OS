/**
 * 执法办案模块 — 案件生命周期管理
 *
 * 8 阶段流程: 线索 → 受理 → 立案 → 调查 → 告知 → 决定 → 执行 → 归档
 */
import React, { useState, useMemo, useEffect } from "react"
import {
  Row, Col, Card, Table, Tag, Typography, Space, Button, Select,
  Input, Statistic, Badge, Timeline, Descriptions, Drawer, message, Spin,
} from "antd"
import {
  ThunderboltOutlined, SearchOutlined, PlusOutlined,
  EyeOutlined, ArrowRightOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined,
  EnvironmentOutlined, FileProtectOutlined, ReloadOutlined,
} from "@ant-design/icons"
import { enforcementApi } from "@/services/businessApi"

const { Title, Text } = Typography

type CaseStage = "线索" | "受理" | "立案" | "调查" | "告知" | "决定" | "执行" | "归档"
type CaseSeverity = "高" | "中" | "低"

interface EnforcementCase {
  id: string
  title: string
  stage: CaseStage
  severity: CaseSeverity
  city: string
  source: string
  description: string
  createdAt: string
  updatedAt: string
  assignee: string
  timeline: { stage: CaseStage; time: string; operator: string; comment: string }[]
}

const STAGE_COLOR: Record<CaseStage, string> = {
  "线索": "default", "受理": "lime", "立案": "blue", "调查": "processing",
  "告知": "warning", "决定": "orange", "执行": "purple", "归档": "success",
}

const STAGE_ORDER: CaseStage[] = ["线索", "受理", "立案", "调查", "告知", "决定", "执行", "归档"]

const MOCK_CASES: EnforcementCase[] = [
  { id: "CASE-2026-001", title: "长沙XX化工废水超标排放案", stage: "调查", severity: "高", city: "长沙市", source: "在线监测", description: "COD超标3.2倍，氨氮超标1.8倍", createdAt: "2026-05-20", updatedAt: "2026-05-26", assignee: "张执法员", timeline: [
    { stage: "线索", time: "2026-05-20", operator: "监测系统", comment: "自动监测发现异常数据" },
    { stage: "受理", time: "2026-05-21", operator: "张执法员", comment: "核实监测数据，确认违法事实初步存在" },
    { stage: "立案", time: "2026-05-22", operator: "李队长", comment: "批准立案调查" },
    { stage: "调查", time: "2026-05-23", operator: "张执法员", comment: "现场取证，采集水样，制作调查笔录" },
  ]},
  { id: "CASE-2026-002", title: "岳阳洞庭湖非法采砂案", stage: "告知", severity: "高", city: "岳阳市", source: "群众举报", description: "夜间非法采砂，破坏湿地生态", createdAt: "2026-05-18", updatedAt: "2026-05-25", assignee: "王执法员", timeline: [
    { stage: "线索", time: "2026-05-18", operator: "举报平台", comment: "接到群众实名举报" },
    { stage: "受理", time: "2026-05-19", operator: "王执法员", comment: "初步核实举报内容" },
    { stage: "立案", time: "2026-05-20", operator: "刘队长", comment: "批准立案" },
    { stage: "调查", time: "2026-05-21", operator: "王执法员", comment: "夜间突击检查，查获采砂船2艘" },
    { stage: "告知", time: "2026-05-25", operator: "王执法员", comment: "送达行政处罚事先告知书" },
  ]},
  { id: "CASE-2026-003", title: "株洲XX冶炼厂废气直排案", stage: "决定", severity: "中", city: "株洲市", source: "无人机巡查", description: "SO2排放超标，未运行脱硫设施", createdAt: "2026-05-15", updatedAt: "2026-05-24", assignee: "赵执法员", timeline: [
    { stage: "线索", time: "2026-05-15", operator: "无人机", comment: "热成像发现异常排放" },
    { stage: "受理", time: "2026-05-16", operator: "赵执法员", comment: "调取在线监测历史数据" },
    { stage: "立案", time: "2026-05-17", operator: "李队长", comment: "批准立案" },
    { stage: "调查", time: "2026-05-18", operator: "赵执法员", comment: "现场检查，封存生产记录" },
    { stage: "告知", time: "2026-05-20", operator: "赵执法员", comment: "送达告知书" },
    { stage: "决定", time: "2026-05-24", operator: "李队长", comment: "作出罚款50万元行政处罚决定" },
  ]},
  { id: "CASE-2026-004", title: "衡阳XX养殖场废水直排湘江案", stage: "执行", severity: "中", city: "衡阳市", source: "日常巡查", description: "养殖废水未经处理直排，影响下游水质", createdAt: "2026-05-10", updatedAt: "2026-05-22", assignee: "陈执法员", timeline: [
    { stage: "线索", time: "2026-05-10", operator: "巡查组", comment: "日常巡查发现" },
    { stage: "受理", time: "2026-05-11", operator: "陈执法员", comment: "核实情况" },
    { stage: "立案", time: "2026-05-12", operator: "李队长", comment: "批准立案" },
    { stage: "调查", time: "2026-05-13", operator: "陈执法员", comment: "取样检测" },
    { stage: "告知", time: "2026-05-15", operator: "陈执法员", comment: "告知" },
    { stage: "决定", time: "2026-05-18", operator: "李队长", comment: "罚款30万+限期整改" },
    { stage: "执行", time: "2026-05-22", operator: "陈执法员", comment: "罚款已缴纳，整改进行中" },
  ]},
  { id: "CASE-2026-005", title: "郴州XX矿山生态破坏案", stage: "归档", severity: "低", city: "郴州市", source: "环保督察", description: "矿山开采未按环评要求进行生态修复", createdAt: "2026-04-15", updatedAt: "2026-05-20", assignee: "刘执法员", timeline: [
    { stage: "线索", time: "2026-04-15", operator: "督察组", comment: "中央环保督察交办" },
    { stage: "受理", time: "2026-04-16", operator: "刘执法员", comment: "受理" },
    { stage: "立案", time: "2026-04-17", operator: "李队长", comment: "立案" },
    { stage: "调查", time: "2026-04-20", operator: "刘执法员", comment: "现场调查" },
    { stage: "告知", time: "2026-04-25", operator: "刘执法员", comment: "告知" },
    { stage: "决定", time: "2026-04-30", operator: "李队长", comment: "罚款100万+限期恢复" },
    { stage: "执行", time: "2026-05-10", operator: "刘执法员", comment: "执行完毕" },
    { stage: "归档", time: "2026-05-20", operator: "刘执法员", comment: "案件归档" },
  ]},
  { id: "CASE-2026-006", title: "张家界景区餐饮油烟扰民案", stage: "线索", severity: "低", city: "张家界市", source: "信访投诉", description: "核心景区周边餐饮油烟直排", createdAt: "2026-05-25", updatedAt: "2026-05-26", assignee: "-", timeline: [
    { stage: "线索", time: "2026-05-25", operator: "信访办", comment: "多名游客投诉" },
  ]},
]

const EnforcementPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("")
  const [stageFilter, setStageFilter] = useState<string>("all")
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [selectedCase, setSelectedCase] = useState<EnforcementCase | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [apiCases, setApiCases] = useState<EnforcementCase[] | null>(null)

  // Fetch from API on mount, fallback to mock
  const fetchCases = async () => {
    setLoading(true)
    const data = await enforcementApi.list()
    if (data && Array.isArray(data) && data.length > 0) {
      const mapped = data.map((c: any) => ({
        id: c.id || c.case_id || '',
        title: c.title || c.name || '',
        stage: c.stage || c.current_stage || '线索',
        severity: c.severity || c.priority || '中',
        city: c.city || c.department || '',
        source: c.source || '',
        description: c.description || '',
        createdAt: c.created_at || '',
        updatedAt: c.updated_at || '',
        assignee: c.assignee || '-',
        timeline: c.timeline || [],
      }))
      setApiCases(mapped as EnforcementCase[])
    }
    setLoading(false)
  }

  useEffect(() => { fetchCases() }, [])

  const allCases = apiCases || MOCK_CASES

  const filteredCases = useMemo(() => {
    let list = allCases
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(c => c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || (c.city || '').includes(q))
    }
    if (stageFilter !== "all") list = list.filter(c => c.stage === stageFilter)
    if (severityFilter !== "all") list = list.filter(c => c.severity === severityFilter)
    return list
  }, [allCases, searchQuery, stageFilter, severityFilter])

  // Stats
  const stats = useMemo(() => ({
    total: allCases.length,
    active: allCases.filter(c => !["归档"].includes(c.stage)).length,
    high: allCases.filter(c => c.severity === "高").length,
    archived: allCases.filter(c => c.stage === "归档").length,
  }), [allCases])

  const columns = [
    { title: "案件编号", dataIndex: "id", key: "id", width: 140, render: (v: string) => <Text code>{v}</Text> },
    { title: "案件名称", dataIndex: "title", key: "title", ellipsis: true },
    { title: "城市", dataIndex: "city", key: "city", width: 80, render: (v: string) => <Tag>{v}</Tag> },
    { title: "当前阶段", dataIndex: "stage", key: "stage", width: 80, render: (v: CaseStage) => <Tag color={STAGE_COLOR[v]}>{v}</Tag> },
    { title: "严重程度", dataIndex: "severity", key: "severity", width: 80,
      render: (v: CaseSeverity) => <Badge status={v === "高" ? "error" : v === "中" ? "warning" : "processing"} text={v} /> },
    { title: "来源", dataIndex: "source", key: "source", width: 90 },
    { title: "负责人", dataIndex: "assignee", key: "assignee", width: 90 },
    { title: "更新时间", dataIndex: "updatedAt", key: "updatedAt", width: 100 },
    { title: "操作", key: "action", width: 80, fixed: "right" as const,
      render: (_: any, record: EnforcementCase) => (
        <Button type="link" size="small" icon={<EyeOutlined />}
          onClick={() => { setSelectedCase(record); setDetailOpen(true) }}>
          详情
        </Button>
      )},
  ]

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ThunderboltOutlined style={{ color: "#DC2626", marginRight: 8 }} />
            执法办案
          </Title>
          <Text type="secondary">生态环境违法案件全生命周期管理 · 8 阶段流程</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchCases} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />}>新建案件</Button>
        </Space>
      </div>

      {/* KPI Cards */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="案件总数" value={stats.total} prefix={<FileProtectOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="在办案件" value={stats.active} valueStyle={{ color: "#F59E0B" }} prefix={<ClockCircleOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="高风险" value={stats.high} valueStyle={{ color: "#DC2626" }} prefix={<ExclamationCircleOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="已归档" value={stats.archived} valueStyle={{ color: "#10B981" }} prefix={<CheckCircleOutlined />} /></Card></Col>
      </Row>

      {/* Filters + Table */}
      <Card size="small" bodyStyle={{ padding: "12px 0 0" }}>
        <div className="flex flex-wrap gap-2 px-3 pb-3">
          <Input prefix={<SearchOutlined />} placeholder="搜索案件..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)} style={{ width: 220 }} allowClear />
          <Select value={stageFilter} onChange={setStageFilter} style={{ width: 120 }}
            options={[{ value: "all", label: "全部阶段" }, ...STAGE_ORDER.map(s => ({ value: s, label: s }))]} />
          <Select value={severityFilter} onChange={setSeverityFilter} style={{ width: 120 }}
            options={[{ value: "all", label: "全部级别" }, { value: "高", label: "高" }, { value: "中", label: "中" }, { value: "低", label: "低" }]} />
        </div>
        <Table dataSource={filteredCases} columns={columns} rowKey="id" size="small"
          pagination={{ pageSize: 10, showSizeChanger: true }} scroll={{ x: 1000 }} />
      </Card>

      {/* Detail Drawer */}
      <Drawer title={selectedCase?.title} open={detailOpen} onClose={() => setDetailOpen(false)} width={560}
        extra={selectedCase && <Tag color={STAGE_COLOR[selectedCase.stage]}>{selectedCase.stage}</Tag>}>
        {selectedCase && (
          <div className="space-y-4">
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="案件编号">{selectedCase.id}</Descriptions.Item>
              <Descriptions.Item label="城市"><EnvironmentOutlined className="mr-1" />{selectedCase.city}</Descriptions.Item>
              <Descriptions.Item label="严重程度">
                <Badge status={selectedCase.severity === "高" ? "error" : selectedCase.severity === "中" ? "warning" : "processing"} text={selectedCase.severity} />
              </Descriptions.Item>
              <Descriptions.Item label="案件来源">{selectedCase.source}</Descriptions.Item>
              <Descriptions.Item label="负责人">{selectedCase.assignee}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{selectedCase.createdAt}</Descriptions.Item>
              <Descriptions.Item label="案件描述" span={2}>{selectedCase.description}</Descriptions.Item>
            </Descriptions>

            <Title level={5}>案件流程</Title>
            <Timeline
              items={selectedCase.timeline.map(t => ({
                color: STAGE_COLOR[t.stage] === "success" ? "green" : STAGE_COLOR[t.stage] === "processing" ? "blue" : STAGE_COLOR[t.stage] === "warning" ? "orange" : STAGE_COLOR[t.stage] === "error" ? "red" : "gray",
                children: (
                  <div>
                    <div className="flex items-center gap-2">
                      <Tag color={STAGE_COLOR[t.stage]}>{t.stage}</Tag>
                      <Text className="text-xs" type="secondary">{t.time}</Text>
                    </div>
                    <div className="text-sm mt-1">{t.comment}</div>
                    <Text className="text-xs" type="secondary">操作人: {t.operator}</Text>
                  </div>
                ),
              }))}
            />
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default EnforcementPage
