/**
 * 报告生成 — 监测日报/执法周报/碳排放月报/环评报告/年度公报
 */
import React, { useState, useEffect } from "react"
import { Row, Col, Card, Table, Tag, Typography, Button, Space, DatePicker, Select, Statistic } from "antd"
import {
  FileTextOutlined, DownloadOutlined, EyeOutlined, BarChartOutlined,
  FilePdfOutlined, FileExcelOutlined, ReloadOutlined,
} from "@ant-design/icons"
import { reportsApi } from "@/services/businessApi"

const { Title, Text } = Typography

const REPORT_TYPES = [
  { key: "daily", label: "监测日报", color: "blue", icon: "📊" },
  { key: "weekly", label: "执法周报", color: "purple", icon: "⚖️" },
  { key: "monthly", label: "碳排放月报", color: "green", icon: "🌿" },
  { key: "eia", label: "环评报告", color: "orange", icon: "📋" },
  { key: "annual", label: "年度公报", color: "red", icon: "📕" },
]

const MOCK_REPORTS = [
  { id: "RPT-001", name: "2026年5月26日环境监测日报", type: "daily", dept: "监测处", time: "2026-05-26 08:00", status: "generated", author: "李处长" },
  { id: "RPT-002", name: "2026年第21周执法工作周报", type: "weekly", dept: "执法局", time: "2026-05-24", status: "generated", author: "张执法员" },
  { id: "RPT-003", name: "2026年4月湖南省碳排放月报", type: "monthly", dept: "大气处", time: "2026-05-05", status: "generated", author: "赵处长" },
  { id: "RPT-004", name: "长沙XX项目环评报告书", type: "eia", dept: "环评处", time: "2026-05-20", status: "review", author: "王处长" },
  { id: "RPT-005", name: "2025年湖南省生态环境状况公报", type: "annual", dept: "综合处", time: "2026-03-15", status: "published", author: "综合处" },
  { id: "RPT-006", name: "2026年5月25日环境监测日报", type: "daily", dept: "监测处", time: "2026-05-25 08:00", status: "generated", author: "李处长" },
  { id: "RPT-007", name: "岳阳XX基础设施环评报告", type: "eia", dept: "环评处", time: "2026-05-18", status: "review", author: "王处长" },
]

type ReportStatus = "generated" | "review" | "published"
const STATUS_MAP: Record<ReportStatus, { color: string; text: string }> = {
  generated: { color: "blue", text: "已生成" },
  review: { color: "orange", text: "待审核" },
  published: { color: "green", text: "已发布" },
}

const AI_TEMPLATES = [
  { name: "监测日报模板 v2.1", desc: "自动采集各市州监测数据生成日报", type: "daily" },
  { name: "执法周报模板 v1.5", desc: "汇总本周执法案件，含统计分析", type: "weekly" },
  { name: "碳排放月报模板 v3.0", desc: "六大高耗能行业碳排放核算", type: "monthly" },
  { name: "环评报告通用模板 v2.0", desc: "含工程分析、环境现状、影响预测", type: "eia" },
  { name: "年度公报模板 v1.0", desc: "全省生态环境状况综合评估", type: "annual" },
]

const ReportsPage: React.FC = () => {
  const [typeFilter, setTypeFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [apiReports, setApiReports] = useState<typeof MOCK_REPORTS | null>(null)

  const fetchReports = async () => {
    setLoading(true)
    const data = await reportsApi.list()
    if (data && Array.isArray(data) && data.length > 0) {
      setApiReports(data.map((r: any) => ({
        id: r.id || r.report_id || '',
        name: r.name || r.title || '',
        type: r.type || r.report_type || 'daily',
        dept: r.department || r.dept || '',
        time: r.created_at || r.time || '',
        status: r.status || 'generated',
        author: r.author || r.generated_by || '',
      })))
    }
    setLoading(false)
  }

  useEffect(() => { fetchReports() }, [])

  const allReports = apiReports || MOCK_REPORTS

  const filtered = typeFilter === "all"
    ? allReports
    : allReports.filter(r => r.type === typeFilter)

  // Stats
  const stats = {
    total: allReports.length,
    generated: allReports.filter(r => r.status === "generated").length,
    review: allReports.filter(r => r.status === "review").length,
    published: allReports.filter(r => r.status === "published").length,
  }

  const columns = [
    { title: "编号", dataIndex: "id", key: "id", width: 100, render: (v: string) => <Text code>{v}</Text> },
    { title: "报告名称", dataIndex: "name", key: "name", ellipsis: true },
    { title: "类型", dataIndex: "type", key: "type", width: 100,
      render: (v: string) => {
        const t = REPORT_TYPES.find(r => r.key === v)
        return <Tag color={t?.color}>{t?.label}</Tag>
      }},
    { title: "生成部门", dataIndex: "dept", key: "dept", width: 90 },
    { title: "作者", dataIndex: "author", key: "author", width: 90 },
    { title: "生成时间", dataIndex: "time", key: "time", width: 160 },
    { title: "状态", dataIndex: "status", key: "status", width: 90,
      render: (v: ReportStatus) => <Tag color={STATUS_MAP[v].color}>{STATUS_MAP[v].text}</Tag> },
    { title: "操作", key: "action", width: 140,
      render: () => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} type="link">查看</Button>
          <Button size="small" icon={<DownloadOutlined />} type="link">下载</Button>
        </Space>
      )},
  ]

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <BarChartOutlined style={{ color: "#8B5CF6", marginRight: 8 }} />
            报告生成
          </Title>
          <Text type="secondary">监测日报 · 执法周报 · 碳排放月报 · 环评报告 · AI 辅助生成</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchReports} loading={loading}>刷新</Button>
          <Button type="primary" icon={<FileTextOutlined />}>AI 生成报告</Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="报告总数" value={stats.total} prefix={<FileTextOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="已生成" value={stats.generated} valueStyle={{ color: "#3B82F6" }} prefix={<FilePdfOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="待审核" value={stats.review} valueStyle={{ color: "#F59E0B" }} prefix={<EyeOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="已发布" value={stats.published} valueStyle={{ color: "#10B981" }} prefix={<FileExcelOutlined />} /></Card></Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={16}>
          <Card size="small" bodyStyle={{ padding: "12px 0 0" }}>
            <div className="flex gap-2 px-3 pb-3">
              <Select value={typeFilter} onChange={setTypeFilter} style={{ width: 130 }}>
                <Select.Option value="all">全部类型</Select.Option>
                {REPORT_TYPES.map(r => <Select.Option key={r.key} value={r.key}>{r.label}</Select.Option>)}
              </Select>
              <DatePicker.RangePicker placeholder={["开始日期", "结束日期"]} />
            </div>
            <Table dataSource={filtered} columns={columns} rowKey="id" size="small"
              pagination={{ pageSize: 8 }} />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card size="small" title="📊 报告类型统计" className="mb-3">
            <div className="flex flex-col gap-3">
              {REPORT_TYPES.map(r => (
                <div key={r.key} className="flex justify-between items-center">
                  <Space>
                    <span>{r.icon}</span>
                    <Tag color={r.color}>{r.label}</Tag>
                  </Space>
                  <Text>{Math.floor(Math.random() * 50 + 10)} 份</Text>
                </div>
              ))}
            </div>
          </Card>
          <Card size="small" title="🤖 AI 模板库">
            <div className="flex flex-col gap-2">
              {AI_TEMPLATES.map((t, i) => (
                <div key={i} className="p-3 rounded-lg bg-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                  <div className="flex justify-between items-start">
                    <Text strong className="text-sm">{t.name}</Text>
                    <FileTextOutlined className="text-blue-500" />
                  </div>
                  <Text type="secondary" className="text-xs">{t.desc}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default ReportsPage
