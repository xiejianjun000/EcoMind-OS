/**
 * 知识图谱 — GraphRAG 可视化探索
 *
 * 展示 EcoMind 知识图谱: 环境法规 ↔ Agent ↔ 工具 ↔ 案例
 * 支持节点搜索、邻居展开、类型筛选、Mermaid 导出
 */
import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Row, Col, Card, Tag, Typography, Space, Button, Input, Select,
  Statistic, List, Spin, Empty, Divider, Tooltip, message,
} from "antd"
import {
  SearchOutlined, NodeIndexOutlined, BranchesOutlined,
  ApartmentOutlined, LinkOutlined, ExportOutlined,
  ThunderboltOutlined, FileTextOutlined, ToolOutlined,
  RobotOutlined, ReloadOutlined,
} from "@ant-design/icons"
import ReactEChartsCore from "echarts-for-react/lib/core"
import * as echarts from "echarts/core"
import { GraphChart } from "echarts/charts"
import { TooltipComponent, LegendComponent } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"

echarts.use([GraphChart, TooltipComponent, LegendComponent, CanvasRenderer])

const { Title, Text, Paragraph } = Typography

// ─── Types ───
interface GraphNode {
  id: string
  label: string
  type: string
  properties: Record<string, any>
}

interface GraphEdge {
  source: string
  target: string
  relation: string
  weight: number
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: { node_count: number; edge_count: number; node_types: Record<string, number> }
}

// ─── Color mapping ───
const TYPE_COLORS: Record<string, string> = {
  regulation: "#3B82F6",
  agent: "#10B981",
  tool: "#F59E0B",
  case: "#EF4444",
  station: "#8B5CF6",
  unknown: "#6B7280",
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  regulation: <FileTextOutlined />,
  agent: <RobotOutlined />,
  tool: <ToolOutlined />,
  case: <ThunderboltOutlined />,
  station: <NodeIndexOutlined />,
}

const API_BASE = "/api"

// ─── Local mock fallback ───
const MOCK_GRAPH: GraphData = {
  nodes: [
    { id: "law-001", label: "《环境保护法》", type: "regulation", properties: { year: 2014 } },
    { id: "law-002", label: "《大气污染防治法》", type: "regulation", properties: { year: 2018 } },
    { id: "law-003", label: "《水污染防治法》", type: "regulation", properties: { year: 2017 } },
    { id: "agent-env", label: "环境监测Agent", type: "agent", properties: {} },
    { id: "agent-enforce", label: "执法辅助Agent", type: "agent", properties: {} },
    { id: "agent-approval", label: "审批辅助Agent", type: "agent", properties: {} },
    { id: "tool-env-data", label: "环境数据查询", type: "tool", properties: {} },
    { id: "tool-law", label: "法规检索", type: "tool", properties: {} },
    { id: "tool-report", label: "报告生成", type: "tool", properties: {} },
  ],
  edges: [
    { source: "agent-env", target: "tool-env-data", relation: "invokes", weight: 1 },
    { source: "agent-enforce", target: "tool-law", relation: "invokes", weight: 1 },
    { source: "agent-approval", target: "tool-law", relation: "invokes", weight: 1 },
    { source: "agent-env", target: "tool-report", relation: "invokes", weight: 1 },
    { source: "tool-law", target: "law-001", relation: "cites", weight: 1 },
    { source: "tool-law", target: "law-002", relation: "cites", weight: 1 },
    { source: "tool-law", target: "law-003", relation: "cites", weight: 1 },
  ],
  stats: { node_count: 9, edge_count: 7, node_types: { regulation: 3, agent: 3, tool: 3 } },
}

const KnowledgeGraphPage: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [searchResults, setSearchResults] = useState<GraphNode[]>([])
  const [mermaidCode, setMermaidCode] = useState("")

  // ─── Fetch full graph ───
  const fetchGraph = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/knowledge-graph/full`)
      if (res.ok) {
        const data = await res.json()
        setGraphData(data)
      } else {
        setGraphData(MOCK_GRAPH)
      }
    } catch {
      setGraphData(MOCK_GRAPH)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchGraph() }, [fetchGraph])

  // ─── Search ───
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    try {
      const res = await fetch(`${API_BASE}/knowledge-graph/search?q=${encodeURIComponent(searchQuery)}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data)
      }
    } catch {
      // Local search on mock
      const nodes = graphData?.nodes || MOCK_GRAPH.nodes
      setSearchResults(nodes.filter(n =>
        n.label.toLowerCase().includes(searchQuery.toLowerCase())
      ))
    }
  }, [searchQuery, graphData])

  useEffect(() => { handleSearch() }, [searchQuery, handleSearch])

  // ─── Mermaid export ───
  const handleMermaidExport = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/knowledge-graph/mermaid`)
      if (res.ok) {
        const data = await res.json()
        setMermaidCode(data.mermaid || "")
      }
    } catch {
      setMermaidCode("graph LR\n  A[API 不可用] -->|fallback| B[本地数据]")
    }
  }, [])

  // ─── ECharts graph option ───
  const graphOption = useMemo(() => {
    const data = graphData || MOCK_GRAPH
    const filteredNodes = typeFilter === "all"
      ? data.nodes
      : data.nodes.filter(n => n.type === typeFilter)

    const filteredNodeIds = new Set(filteredNodes.map(n => n.id))
    const filteredEdges = data.edges.filter(
      e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    )

    return {
      tooltip: {
        formatter: (params: any) => {
          if (params.dataType === "node") {
            const n = params.data
            return `<b>${n.label}</b><br/>类型: ${n.type}<br/>${JSON.stringify(n.properties || {})}`
          }
          return `${params.data.source} → ${params.data.relation} → ${params.data.target}`
        },
      },
      series: [{
        type: "graph" as const,
        layout: "force",
        force: { repulsion: 300, edgeLength: [120, 200], gravity: 0.15 },
        roam: true,
        draggable: true,
        data: filteredNodes.map(n => ({
          id: n.id,
          name: n.label,
          symbolSize: n.type === "regulation" ? 40 : n.type === "agent" ? 35 : 28,
          itemStyle: { color: TYPE_COLORS[n.type] || "#6B7280" },
          category: n.type,
          ...n,
        })),
        edges: filteredEdges.map(e => ({
          source: e.source,
          target: e.target,
          label: { show: true, formatter: e.relation, fontSize: 10 },
          lineStyle: { curveness: 0.1 },
        })),
        categories: Object.keys(TYPE_COLORS).map(t => ({
          name: t,
          itemStyle: { color: TYPE_COLORS[t] },
        })),
        label: { show: true, fontSize: 11, position: "bottom" },
        emphasis: { focus: "adjacency", label: { fontSize: 14 } },
      }],
    }
  }, [graphData, typeFilter])

  // ─── Node type stats ───
  const stats = graphData?.stats || MOCK_GRAPH.stats

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <BranchesOutlined style={{ color: "#8B5CF6", marginRight: 8 }} />
            知识图谱
          </Title>
          <Text type="secondary">GraphRAG · 环境法规 ↔ Agent ↔ 工具 · 交互式探索</Text>
        </div>
        <Space>
          <Button icon={<ExportOutlined />} onClick={handleMermaidExport}>Mermaid</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchGraph} loading={loading}>刷新</Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="节点" value={stats.node_count} prefix={<ApartmentOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="边" value={stats.edge_count} prefix={<LinkOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="法规" value={stats.node_types?.regulation || 0} prefix={<FileTextOutlined />} valueStyle={{ color: "#3B82F6" }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Agent" value={stats.node_types?.agent || 0} prefix={<RobotOutlined />} valueStyle={{ color: "#10B981" }} /></Card></Col>
      </Row>

      <Spin spinning={loading && !graphData}>
        <Row gutter={[12, 12]}>
          {/* Graph Visualization */}
          <Col xs={24} lg={17}>
            <Card size="small" title={
              <Space>
                <BranchesOutlined style={{ color: "#8B5CF6" }} />
                图谱可视化
                <Select value={typeFilter} onChange={setTypeFilter} size="small" style={{ width: 100 }}>
                  <Select.Option value="all">全部类型</Select.Option>
                  {Object.keys(TYPE_COLORS).map(t => (
                    <Select.Option key={t} value={t}>{t}</Select.Option>
                  ))}
                </Select>
              </Space>
            } bodyStyle={{ padding: 0 }}>
              {graphData ? (
                <ReactEChartsCore echarts={echarts} option={graphOption}
                  style={{ height: 500 }}
                  onEvents={{
                    click: (params: any) => {
                      if (params.dataType === "node") {
                        setSelectedNode(params.data)
                      }
                    },
                  }} />
              ) : (
                <Empty description="加载图谱数据..." className="py-24" />
              )}
            </Card>
          </Col>

          {/* Side Panel */}
          <Col xs={24} lg={7}>
            {/* Search */}
            <Card size="small" className="mb-3" title={<><SearchOutlined className="mr-1" />搜索节点</>}>
              <Input.Search placeholder="搜索法规、Agent、工具..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onSearch={handleSearch} allowClear />
              {searchResults.length > 0 && (
                <List size="small" className="mt-2" dataSource={searchResults.slice(0, 8)}
                  renderItem={item => (
                    <List.Item className="cursor-pointer hover:bg-gray-50 px-2 rounded"
                      onClick={() => setSelectedNode(item)}>
                      <Space>
                        <Tag color={TYPE_COLORS[item.type]}>{item.type}</Tag>
                        <Text>{item.label}</Text>
                      </Space>
                    </List.Item>
                  )} />
              )}
            </Card>

            {/* Node Detail */}
            <Card size="small" title={<><ApartmentOutlined className="mr-1" />节点详情</>}>
              {selectedNode ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Tag color={TYPE_COLORS[selectedNode.type]}>{selectedNode.type}</Tag>
                    <Text strong className="text-lg">{selectedNode.label}</Text>
                  </div>
                  {Object.keys(selectedNode.properties || {}).length > 0 && (
                    <div>
                      <Text type="secondary" className="text-xs">属性</Text>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(selectedNode.properties || {}).map(([k, v]) => (
                          <Tag key={k} className="text-xs">{k}: {String(v)}</Tag>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Connected edges */}
                  {graphData && (
                    <div>
                      <Text type="secondary" className="text-xs">关联边</Text>
                      {graphData.edges
                        .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                        .map((e, i) => {
                          const otherId = e.source === selectedNode.id ? e.target : e.source
                          const otherNode = graphData.nodes.find(n => n.id === otherId)
                          return (
                            <div key={i} className="flex items-center gap-2 text-xs mt-1">
                              {e.source === selectedNode.id ? "→" : "←"}
                              <Tag color={TYPE_COLORS[e.relation] || "default"}>{e.relation}</Tag>
                              <Text>{otherNode?.label || otherId}</Text>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <NodeIndexOutlined className="text-4xl mb-2 opacity-20" />
                  <br /><Text type="secondary">点击图谱节点或搜索查看详情</Text>
                </div>
              )}
            </Card>

            {/* Mermaid Code */}
            {mermaidCode && (
              <Card size="small" className="mt-3" title="Mermaid 代码"
                extra={<Button size="small" onClick={() => { navigator.clipboard.writeText(mermaidCode); message.success("已复制") }}>复制</Button>}>
                <pre className="text-xs bg-gray-50 p-2 rounded max-h-40 overflow-auto">{mermaidCode}</pre>
              </Card>
            )}
          </Col>
        </Row>
      </Spin>
    </div>
  )
}

export default KnowledgeGraphPage
