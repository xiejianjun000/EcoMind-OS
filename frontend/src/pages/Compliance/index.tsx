/**
 * 合规检查 — SafetyChain 六层安全 + 法规合规检查
 */
import React, { useMemo } from "react"
import { Row, Col, Card, Tag, Typography, Progress, List, Space, Descriptions } from "antd"
import {
  SafetyCertificateOutlined, CheckCircleOutlined, WarningOutlined,
  CloseCircleOutlined, SafetyOutlined, SearchOutlined, FileTextOutlined,
} from "@ant-design/icons"
import ReactEChartsCore from "echarts-for-react/lib/core"
import * as echarts from "echarts/core"
import { RadarChart } from "echarts/charts"
import { TooltipComponent, LegendComponent, RadarComponent } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"

echarts.use([RadarChart, TooltipComponent, LegendComponent, RadarComponent, CanvasRenderer])

const { Title, Text } = Typography

const CHAIN_LAYERS = [
  { level: "L1", name: "输入护栏", desc: "Prompt注入检测 / PII脱敏", passRate: 99.9, status: "pass" },
  { level: "L2", name: "策略护栏", desc: "合规范围检查 / 执法质量", passRate: 99.7, status: "pass" },
  { level: "L3", name: "输出验证", desc: "数据真实性 / 法规引用", passRate: 98.2, status: "warning" },
  { level: "L4", name: "幻觉检测", desc: "数值合理性 / 不确定性", passRate: 99.1, status: "pass" },
  { level: "L5", name: "审计追踪", desc: "Agent决策日志 / 溯源", passRate: 100, status: "pass" },
  { level: "L6", name: "政务审批", desc: "GOVMCP SM2/SM3/SM4", passRate: 99.5, status: "pass" },
]

const RECENT_FINDINGS = [
  { title: "L4 幻觉检测拦截", desc: "执法Agent输出含\"可能\"3次，置信度0.45", severity: "medium", time: "14:28" },
  { title: "L1 输入注入告警", desc: "检测到prompt injection尝试", severity: "high", time: "12:05" },
  { title: "L3 输出验证未通过", desc: "引用法条版本过期（2018→2023修正版）", severity: "medium", time: "10:42" },
  { title: "L6 国密签名异常", desc: "SM2证书即将过期（剩余7天）", severity: "low", time: "09:15" },
]

const REGULATIONS = [
  { name: "《环境保护法》", articles: 70, status: "current", lastUpdate: "2014-04-24" },
  { name: "《大气污染防治法》", articles: 129, status: "current", lastUpdate: "2018-10-26" },
  { name: "《水污染防治法》", articles: 103, status: "current", lastUpdate: "2017-06-27" },
  { name: "《环境影响评价法》", articles: 38, status: "amended", lastUpdate: "2018-12-29" },
  { name: "《排污许可管理条例》", articles: 51, status: "current", lastUpdate: "2021-03-01" },
  { name: "《土壤污染防治法》", articles: 99, status: "current", lastUpdate: "2019-01-01" },
  { name: "《噪声污染防治法》", articles: 90, status: "current", lastUpdate: "2022-06-05" },
  { name: "《固体废物污染环境防治法》", articles: 126, status: "current", lastUpdate: "2020-09-01" },
]

const CompliancePage: React.FC = () => {
  const radarOption = useMemo(() => ({
    tooltip: {},
    legend: { data: ["当前得分", "基线要求"] },
    radar: {
      indicator: [
        { name: "输入安全", max: 100 }, { name: "策略合规", max: 100 },
        { name: "输出质量", max: 100 }, { name: "幻觉控制", max: 100 },
        { name: "审计完整", max: 100 }, { name: "政务审批", max: 100 },
      ],
    },
    series: [{
      type: "radar" as const,
      data: [
        { value: [98, 96, 92, 95, 100, 97], name: "当前得分", areaStyle: { color: "rgba(0,168,107,0.2)" }, lineStyle: { color: "#00A86B" } },
        { value: [90, 85, 80, 85, 90, 90], name: "基线要求", areaStyle: { color: "rgba(59,130,246,0.1)" }, lineStyle: { color: "#3B82F6", type: "dashed" as const } },
      ],
    }],
  }), [])

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div>
        <Title level={3} style={{ margin: 0 }}>
          <SafetyOutlined style={{ color: "#00A86B", marginRight: 8 }} />
          合规检查
        </Title>
        <Text type="secondary">SafetyChain 六层防护 · 法规标准查询 · 自动化合规检查</Text>
      </div>

      {/* SafetyChain */}
      <Card size="small" title={<><SafetyCertificateOutlined style={{ color: "#00A86B" }} /> SafetyChain 六层实时状态</>}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          {CHAIN_LAYERS.map((layer, idx) => (
            <React.Fragment key={layer.level}>
              <div className="text-center px-2 py-3 flex-1 min-w-[90px]">
                <div className="text-xs text-gray-500 mb-1">{layer.level}</div>
                <Progress type="circle" percent={layer.passRate} size={60}
                  strokeColor={layer.status === "pass" ? "#10B981" : "#F59E0B"}
                  format={p => `${p?.toFixed(1)}%`} />
                <div className="mt-1"><Text strong className="text-xs">{layer.name}</Text></div>
                <Text type="secondary" className="text-xs">{layer.desc}</Text>
              </div>
              {idx < CHAIN_LAYERS.length - 1 && <Text className="text-gray-300 text-lg">→</Text>}
            </React.Fragment>
          ))}
        </div>
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="安全雷达图">
            <ReactEChartsCore echarts={echarts} option={radarOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="最近安全发现" extra={<Tag color="orange">4 条</Tag>}>
            <List size="small" dataSource={RECENT_FINDINGS}
              renderItem={(item) => (
                <List.Item style={{ padding: "8px 0" }}>
                  <div className="w-full">
                    <div className="flex justify-between">
                      <Space>
                        {item.severity === "high" ? <CloseCircleOutlined style={{ color: "#DC2626" }} /> :
                         item.severity === "medium" ? <WarningOutlined style={{ color: "#F59E0B" }} /> :
                         <CheckCircleOutlined style={{ color: "#10B981" }} />}
                        <Text strong className="text-sm">{item.title}</Text>
                      </Space>
                      <Text type="secondary" className="text-xs">{item.time}</Text>
                    </div>
                    <Text type="secondary" className="text-xs ml-6">{item.desc}</Text>
                  </div>
                </List.Item>
              )} />
          </Card>
        </Col>
      </Row>

      {/* Regulations */}
      <Card size="small" title={<><FileTextOutlined style={{ color: "#3B82F6" }} /> 法规标准数据库</>}
        extra={<Tag color="blue">{REGULATIONS.length} 部法规</Tag>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {REGULATIONS.map((reg) => (
            <div key={reg.name} className="border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between mb-2">
                <Text strong className="text-sm truncate">{reg.name}</Text>
                <Tag color={reg.status === "current" ? "green" : "orange"} className="text-xs">
                  {reg.status === "current" ? "现行" : "修订"}
                </Tag>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{reg.articles} 条</span>
                <span>更新: {reg.lastUpdate}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default CompliancePage
