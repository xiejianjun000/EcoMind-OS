/**
 * 环评审批中心 — 三级审批 + AI 预审
 */
import React, { useState, useMemo, useEffect } from "react"
import {
  Row, Col, Card, Table, Tag, Typography, Space, Button, Select,
  Statistic, Descriptions, List, message, Spin,
} from "antd"
import {
  AuditOutlined, CheckOutlined, CloseOutlined, ClockCircleOutlined,
  SafetyCertificateOutlined, FileProtectOutlined, SearchOutlined, ReloadOutlined,
} from "@ant-design/icons"
import { approvalApi } from "@/services/businessApi"

const { Title, Text } = Typography

type ApprovalLevel = "L1" | "L2" | "L3"
type ApprovalStatus = "pending" | "approved" | "rejected"
type ApprovalType = "排污许可" | "环评审批" | "辐射安全" | "危废经营许可" | "建设项目验收"

interface ApprovalItem {
  id: string
  type: ApprovalType
  applicant: string
  level: ApprovalLevel
  status: ApprovalStatus
  submitTime: string
  deadline: string
  urgency: "urgent" | "normal" | "low"
  aiPrediction?: { score: number; issues: string[] }
}

const MOCK_APPROVALS: ApprovalItem[] = [
  { id: "AP-2026-001", type: "排污许可", applicant: "长沙XX化工有限公司", level: "L2", status: "pending", submitTime: "2026-05-25 10:30", deadline: "2026-06-08", urgency: "normal", aiPrediction: { score: 0.88, issues: ["需补充应急预案"] } },
  { id: "AP-2026-002", type: "环评审批", applicant: "岳阳XX基础设施项目", level: "L3", status: "pending", submitTime: "2026-05-24 15:00", deadline: "2026-06-24", urgency: "urgent", aiPrediction: { score: 0.72, issues: ["公众参与材料不完整", "生态影响评估需补充"] } },
  { id: "AP-2026-003", type: "辐射安全", applicant: "衡阳XX人民医院", level: "L2", status: "pending", submitTime: "2026-05-23 09:15", deadline: "2026-06-06", urgency: "normal", aiPrediction: { score: 0.95, issues: [] } },
  { id: "AP-2026-004", type: "危废经营许可", applicant: "株洲XX环保科技公司", level: "L3", status: "approved", submitTime: "2026-05-20 11:00", deadline: "2026-06-03", urgency: "low" },
  { id: "AP-2026-005", type: "建设项目验收", applicant: "郴州XX矿山治理项目", level: "L1", status: "rejected", submitTime: "2026-05-18 08:30", deadline: "2026-05-31", urgency: "urgent" },
  { id: "AP-2026-006", type: "排污许可", applicant: "湘潭XX电镀厂", level: "L2", status: "pending", submitTime: "2026-05-25 14:00", deadline: "2026-06-08", urgency: "urgent", aiPrediction: { score: 0.65, issues: ["废水处理工艺存疑", "排污总量超标"] } },
]

const TYPE_COLORS: Record<ApprovalType, string> = {
  "排污许可": "green", "环评审批": "blue", "辐射安全": "orange", "危废经营许可": "red", "建设项目验收": "purple",
}

const ApprovalPage: React.FC = () => {
  const [selected, setSelected] = useState<ApprovalItem | null>(null)
  const [filter, setFilter] = useState<string>("pending")
  const [loading, setLoading] = useState(false)
  const [apiData, setApiData] = useState<ApprovalItem[] | null>(null)

  const fetchApprovals = async () => {
    setLoading(true)
    const data = await approvalApi.list()
    if (data && Array.isArray(data) && data.length > 0) {
      setApiData(data.map((a: any) => ({
        id: a.id || a.approval_id || '',
        type: a.type || a.approval_type || '',
        applicant: a.applicant || a.submitter || '',
        level: a.level || 'L1',
        status: a.status || 'pending',
        submitTime: a.submit_time || a.created_at || '',
        deadline: a.deadline || '',
        urgency: a.urgency || 'normal',
        aiPrediction: a.ai_prediction,
      })) as ApprovalItem[])
    }
    setLoading(false)
  }

  useEffect(() => { fetchApprovals() }, [])

  const allApprovals = apiData || MOCK_APPROVALS

  const filtered = useMemo(() =>
    allApprovals.filter(a => filter === "all" || a.status === filter),
    [allApprovals, filter]
  )

  const stats = useMemo(() => ({
    pending: allApprovals.filter(a => a.status === "pending").length,
    approved: allApprovals.filter(a => a.status === "approved").length,
    rejected: allApprovals.filter(a => a.status === "rejected").length,
  }), [allApprovals])

  const columns = [
    { title: "审批编号", dataIndex: "id", key: "id", width: 130, render: (v: string) => <Text code>{v}</Text> },
    { title: "类型", dataIndex: "type", key: "type", width: 110,
      render: (v: ApprovalType) => <Tag color={TYPE_COLORS[v]}>{v}</Tag> },
    { title: "申请单位", dataIndex: "applicant", key: "applicant", ellipsis: true },
    { title: "级别", dataIndex: "level", key: "level", width: 80,
      render: (v: ApprovalLevel) => <Tag color={v === "L3" ? "red" : v === "L2" ? "orange" : "green"}>{v} {v === "L3" ? "会签" : v === "L2" ? "双因子" : "单签"}</Tag> },
    { title: "状态", dataIndex: "status", key: "status", width: 80,
      render: (v: ApprovalStatus) => {
        const m: Record<ApprovalStatus, { color: string; text: string }> = { pending: "orange", approved: "green", rejected: "red" }
        return <Tag color={m[v].color}>{v === "pending" ? "待审批" : v === "approved" ? "已通过" : "已驳回"}</Tag>
      }},
    { title: "紧急", dataIndex: "urgency", key: "urgency", width: 60,
      render: (v: string) => v === "urgent" ? <Tag color="red">紧急</Tag> : null },
    { title: "提交时间", dataIndex: "submitTime", key: "submitTime", width: 140 },
  ]

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <AuditOutlined style={{ color: "#0E7490", marginRight: 8 }} />
            审批中心
          </Title>
          <Text type="secondary">环评审批 · 排污许可 · 辐射安全 · 三级审批 + AI 预审</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchApprovals} loading={loading}>刷新</Button>
          <Select value={filter} onChange={setFilter} style={{ width: 120 }}>
            <Select.Option value="pending">待我审批</Select.Option>
            <Select.Option value="approved">已通过</Select.Option>
            <Select.Option value="rejected">已驳回</Select.Option>
            <Select.Option value="all">全部</Select.Option>
          </Select>
        </Space>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={6}><Card size="small"><Statistic title="待审批" value={stats.pending} valueStyle={{ color: "#F59E0B" }} prefix={<ClockCircleOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card size="small"><Statistic title="已通过" value={stats.approved} valueStyle={{ color: "#10B981" }} prefix={<CheckOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card size="small"><Statistic title="已驳回" value={stats.rejected} valueStyle={{ color: "#DC2626" }} prefix={<CloseOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card size="small"><Statistic title="平均时限" value="2.3h" suffix="/件" prefix={<ClockCircleOutlined />} /></Card></Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={15}>
          <Card size="small" bodyStyle={{ padding: "12px 0 0" }}>
            <Table dataSource={filtered} columns={columns} rowKey="id" size="small"
              pagination={{ pageSize: 8 }}
              onRow={(r) => ({ onClick: () => setSelected(r), style: { cursor: "pointer", background: selected?.id === r.id ? "#e6f7ff" : undefined } })} />
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          {selected ? (
            <Card size="small" title={<Space><AuditOutlined /> {selected.id}</Space>}
              extra={selected.status === "pending" ? (
                <Space>
                  <Button size="small" type="primary" danger icon={<CloseOutlined />}>驳回</Button>
                  <Button size="small" type="primary" icon={<CheckOutlined />} style={{ background: "#10B981", borderColor: "#10B981" }}>通过</Button>
                </Space>
              ) : null}>
              <Descriptions column={1} size="small" bordered className="mb-3">
                <Descriptions.Item label="审批类型">{selected.type}</Descriptions.Item>
                <Descriptions.Item label="申请单位">{selected.applicant}</Descriptions.Item>
                <Descriptions.Item label="安全级别">
                  <Tag color={selected.level === "L3" ? "red" : "orange"}>{selected.level}级</Tag>
                  {selected.level === "L1" && "（单签）"}{selected.level === "L2" && "（双因子认证）"}{selected.level === "L3" && "（多部门会签+区块链存证）"}
                </Descriptions.Item>
                <Descriptions.Item label="提交时间">{selected.submitTime}</Descriptions.Item>
                <Descriptions.Item label="审批期限">{selected.deadline}</Descriptions.Item>
              </Descriptions>

              {selected.aiPrediction && (
                <Card size="small" style={{ background: "#f0f5ff", marginBottom: 12 }}>
                  <Title level={5} style={{ color: "#3B82F6", margin: 0 }}><SearchOutlined /> AI预审意见</Title>
                  <div className="mt-2">
                    <Text>综合评分: </Text>
                    <Text strong style={{ fontSize: 18, color: selected.aiPrediction.score >= 0.85 ? "#10B981" : "#F59E0B" }}>
                      {(selected.aiPrediction.score * 100).toFixed(0)}%
                    </Text>
                    {selected.aiPrediction.issues.length > 0 && (
                      <div className="mt-2">
                        <Text type="secondary">需关注问题:</Text>
                        {selected.aiPrediction.issues.map((issue, i) => (
                          <div key={i} className="mt-1"><Tag color="orange">⚠ {issue}</Tag></div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              )}

              <Card size="small" title="申请材料">
                <List size="small" dataSource={["申请表", "监测报告", "公众参与材料", "环评文件"]}
                  renderItem={(item, i) => (
                    <List.Item style={{ padding: "4px 0", cursor: "pointer" }}>
                      <FileProtectOutlined style={{ marginRight: 8, color: "#3B82F6" }} />
                      <Text>{item}</Text>
                      <Tag color="green" style={{ marginLeft: "auto" }}>✓</Tag>
                    </List.Item>
                  )} />
              </Card>
            </Card>
          ) : (
            <Card size="small">
              <div className="text-center py-12 text-gray-400">
                <AuditOutlined className="text-5xl mb-4 opacity-20" />
                <br /><Text type="secondary">选择审批单查看详情和AI预审意见</Text>
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  )
}

export default ApprovalPage
