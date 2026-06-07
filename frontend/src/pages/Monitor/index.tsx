/**
 * Environmental Monitor — 湖南省环境数据实时监测面板
 *
 * 利用 envDataService (WAQI + Open-Meteo) 展示 14 市州实时环境数据。
 * 包含：AQI 概览卡片、等级分布饼图、城市详情、监测站列表。
 */
import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Row, Col, Card, Statistic, Tag, Table, Typography, Button, Space,
  Spin, Select, Descriptions, Divider, Progress, Empty, Tooltip, Badge,
} from "antd"
import {
  ReloadOutlined, EnvironmentOutlined, DashboardOutlined,
  CloudOutlined, ExperimentOutlined, WarningOutlined,
  CheckCircleOutlined, ClockCircleOutlined,
} from "@ant-design/icons"
import ReactEChartsCore from "echarts-for-react/lib/core"
import * as echarts from "echarts/core"
import { PieChart } from "echarts/charts"
import { TooltipComponent, LegendComponent } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import type { CityAQI, StationInfo, WaterQuality } from "@/services/envDataService"
import {
  getAllCitiesAQI, getCityStations, getCityWaterQuality,
} from "@/services/envDataService"
import { AgentStatusBar } from "@/components/AgentStatus/AgentStatusBar"

echarts.use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

const { Title, Text } = Typography

// ─── AQI Level Config ───
const AQI_LEVEL: Record<string, { color: string; bg: string; text: string }> = {
  "优": { color: "#10B981", bg: "#ECFDF5", text: "#065F46" },
  "良": { color: "#F59E0B", bg: "#FFFBEB", text: "#92400E" },
  "轻度污染": { color: "#F97316", bg: "#FFF7ED", text: "#9A3412" },
  "中度污染": { color: "#EF4444", bg: "#FEF2F2", text: "#991B1B" },
  "重度污染": { color: "#7C3AED", bg: "#F5F3FF", text: "#5B21B6" },
  "严重污染": { color: "#881337", bg: "#FFF1F2", text: "#4C0519" },
}

const MonitorPage: React.FC = () => {
  // ── State ──
  const [cities, setCities] = useState<CityAQI[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState<string>("长沙市")
  const [stations, setStations] = useState<StationInfo[]>([])
  const [waterData, setWaterData] = useState<WaterQuality[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  // ── Data Fetch ──
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAllCitiesAQI()
      setCities(data)
      setLastRefresh(new Date())
    } catch (e: any) {
      setError(e.message || "数据加载失败")
      console.error("[Monitor] fetch error:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Auto Refresh (5min) ──
  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [autoRefresh, fetchData])

  // ── City Detail ──
  useEffect(() => {
    if (!selectedCity) return
    setStations(getCityStations(selectedCity))
    setWaterData(getCityWaterQuality(selectedCity))
  }, [selectedCity])

  // ── Derived Data ──
  const selectedCityData = useMemo(
    () => cities.find((c) => c.city === selectedCity) ?? null,
    [cities, selectedCity]
  )

  // AQI 等级分布统计
  const aqiDistribution = useMemo(() => {
    const map: Record<string, number> = {}
    cities.forEach((c) => {
      map[c.level] = (map[c.level] || 0) + 1
    })
    return map
  }, [cities])

  // Pie chart option
  const pieOption = useMemo(() => {
    const data = Object.entries(aqiDistribution).map(([name, value]) => ({
      name,
      value,
      itemStyle: { color: AQI_LEVEL[name]?.color || "#6B7280" },
    }))
    return {
      tooltip: { trigger: "item" as const, formatter: "{b}: {c} 市 ({d}%)" },
      legend: { bottom: 0 },
      series: [
        {
          type: "pie" as const,
          radius: ["45%", "75%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: false,
          label: { show: true, formatter: "{b}\n{c}" },
          data,
        },
      ],
    }
  }, [aqiDistribution])

  // ── Stats ──
  const avgAqi = useMemo(
    () => cities.length > 0 ? Math.round(cities.reduce((s, c) => s + c.aqi, 0) / cities.length) : 0,
    [cities]
  )
  const goodCities = cities.filter((c) => c.level === "优" || c.level === "良").length
  const pollutedCities = cities.filter(
    (c) => c.level !== "优" && c.level !== "良"
  ).length

  // ── Station columns ──
  const stationColumns = [
    { title: "站点名称", dataIndex: "name", key: "name" },
    {
      title: "坐标",
      key: "coords",
      render: (_: any, r: StationInfo) => (
        <Text code className="text-xs">
          {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
        </Text>
      ),
    },
    {
      title: "状态",
      key: "status",
      render: () => <Badge status="processing" text="运行中" />,
    },
  ]

  // ── Render ──
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* ═══ Header ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <DashboardOutlined style={{ color: "#10B981", marginRight: 8 }} />
            环境数据监测
          </Title>
          <Text type="secondary">
            湖南省 14 市州实时环境质量数据 · WAQI + Open-Meteo
          </Text>
        </div>
        <Space>
          <Button
            size="small"
            type={autoRefresh ? "primary" : "default"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <ClockCircleOutlined /> 自动刷新: {autoRefresh ? "开" : "关"}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            刷新
          </Button>
          <Text type="secondary" className="text-xs">
            更新于 {lastRefresh.toLocaleTimeString("zh-CN")}
          </Text>
        </Space>
      </div>

      {/* ═══ Error ═══ */}
      {error && (
        <Card size="small" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <Space>
            <WarningOutlined style={{ color: "#DC2626" }} />
            <Text type="danger">{error}</Text>
            <Button size="small" onClick={fetchData}>重试</Button>
          </Space>
        </Card>
      )}

      <Spin spinning={loading && cities.length === 0} tip="加载环境数据...">

        {/* ═══ KPI Cards ═══ */}
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="监测城市"
                value={cities.length}
                prefix={<EnvironmentOutlined />}
                suffix="个"
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="平均 AQI"
                value={avgAqi}
                prefix={<CloudOutlined />}
                valueStyle={{
                  color:
                    avgAqi <= 50 ? "#10B981" : avgAqi <= 100 ? "#F59E0B" : "#EF4444",
                }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="优良城市"
                value={goodCities}
                suffix={`/ ${cities.length}`}
                prefix={<CheckCircleOutlined style={{ color: "#10B981" }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="污染城市"
                value={pollutedCities}
                valueStyle={{ color: pollutedCities > 0 ? "#EF4444" : "#10B981" }}
                prefix={
                  pollutedCities > 0 ? (
                    <WarningOutlined style={{ color: "#EF4444" }} />
                  ) : (
                    <CheckCircleOutlined style={{ color: "#10B981" }} />
                  )
                }
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[12, 12]}>
          {/* ═══ City AQI Cards ═══ */}
          <Col xs={24} lg={14}>
            <Card
              size="small"
              title="各市州 AQI 概览"
              className="h-full"
              bodyStyle={{ maxHeight: 520, overflow: "auto", padding: "8px 12px" }}
            >
              {cities.length === 0 && !loading ? (
                <Empty description="暂无数据" />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {cities.map((city) => {
                    const cfg = AQI_LEVEL[city.level] || AQI_LEVEL["良"]
                    const isSelected = selectedCity === city.city
                    return (
                      <div
                        key={city.city}
                        onClick={() => setSelectedCity(city.city)}
                        className="cursor-pointer rounded-lg border p-2.5 transition-all hover:shadow-md"
                        style={{
                          borderColor: isSelected ? cfg.color : "#e5e7eb",
                          background: isSelected ? cfg.bg : "#fff",
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Text strong className="text-sm truncate">
                            {city.city.replace("市", "")}
                          </Text>
                          <Tag
                            color={cfg.color}
                            className="text-xs"
                            style={{ margin: 0 }}
                          >
                            {city.level}
                          </Tag>
                        </div>
                        <div className="flex items-baseline gap-1 mb-1">
                          <span
                            className="text-2xl font-bold"
                            style={{ color: cfg.color }}
                          >
                            {city.aqi}
                          </span>
                          <span className="text-xs text-gray-400">AQI</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>PM2.5: {city.pm25}</span>
                          <span>{city.temperature}°C</span>
                        </div>
                        <div className="mt-1">
                          <Tooltip title={`首要污染物: ${city.primaryPollutant}`}>
                            <Progress
                              percent={Math.min((city.aqi / 300) * 100, 100)}
                              strokeColor={cfg.color}
                              showInfo={false}
                              size="small"
                            />
                          </Tooltip>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </Col>

          {/* ═══ AQI Pie Chart ═══ */}
          <Col xs={24} lg={10}>
            <Card size="small" title="AQI 等级分布" className="h-full">
              {cities.length === 0 ? (
                <Empty description="暂无数据" />
              ) : (
                <ReactEChartsCore
                  echarts={echarts}
                  option={pieOption}
                  style={{ height: 320 }}
                />
              )}
            </Card>
          </Col>
        </Row>

        {/* ═══ City Detail ═══ */}
        {selectedCityData && (
          <Row gutter={[12, 12]}>
            <Col xs={24} lg={14}>
              <Card
                size="small"
                title={
                  <Space>
                    <EnvironmentOutlined style={{ color: "#3B82F6" }} />
                    {selectedCity} · 详细数据
                  </Space>
                }
                extra={
                  <Select
                    size="small"
                    value={selectedCity}
                    onChange={setSelectedCity}
                    style={{ width: 120 }}
                    options={cities.map((c) => ({
                      value: c.city,
                      label: c.city.replace("市", ""),
                    }))}
                  />
                }
              >
                <Descriptions column={{ xs: 2, sm: 3 }} size="small" bordered>
                  <Descriptions.Item label="AQI">
                    <Text
                      strong
                      style={{
                        color: AQI_LEVEL[selectedCityData.level]?.color,
                        fontSize: 18,
                      }}
                    >
                      {selectedCityData.aqi}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="等级">
                    <Tag color={AQI_LEVEL[selectedCityData.level]?.color}>
                      {selectedCityData.level}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="首要污染物">
                    {selectedCityData.primaryPollutant}
                  </Descriptions.Item>
                  <Descriptions.Item label="PM2.5">
                    {selectedCityData.pm25} µg/m³
                  </Descriptions.Item>
                  <Descriptions.Item label="PM10">
                    {selectedCityData.pm10} µg/m³
                  </Descriptions.Item>
                  <Descriptions.Item label="O₃">
                    {selectedCityData.o3} µg/m³
                  </Descriptions.Item>
                  <Descriptions.Item label="NO₂">
                    {selectedCityData.no2} µg/m³
                  </Descriptions.Item>
                  <Descriptions.Item label="SO₂">
                    {selectedCityData.so2} µg/m³
                  </Descriptions.Item>
                  <Descriptions.Item label="CO">
                    {selectedCityData.co} mg/m³
                  </Descriptions.Item>
                  <Descriptions.Item label="温度">
                    {selectedCityData.temperature}°C
                  </Descriptions.Item>
                  <Descriptions.Item label="湿度">
                    {selectedCityData.humidity}%
                  </Descriptions.Item>
                  <Descriptions.Item label="风向风力">
                    {selectedCityData.wind}
                  </Descriptions.Item>
                </Descriptions>

                {/* Water Quality */}
                {waterData.length > 0 && (
                  <>
                    <Divider orientation="left" className="!my-3">
                      <ExperimentOutlined className="mr-1" />
                      水质监测
                    </Divider>
                    {waterData.map((w, i) => (
                      <Descriptions
                        key={i}
                        column={{ xs: 2, sm: 4 }}
                        size="small"
                        bordered
                        className="mb-2"
                      >
                        <Descriptions.Item label="河流">
                          {w.riverName}
                        </Descriptions.Item>
                        <Descriptions.Item label="断面">
                          {w.section}
                        </Descriptions.Item>
                        <Descriptions.Item label="水质等级">
                          <Tag color={w.level.includes("Ⅱ") ? "green" : w.level.includes("Ⅲ") ? "blue" : "orange"}>
                            {w.level}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="评价">
                          <Tag color={w.grade === "优良" ? "green" : "blue"}>
                            {w.grade}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="pH">{w.ph}</Descriptions.Item>
                        <Descriptions.Item label="溶解氧">
                          {w.do} mg/L
                        </Descriptions.Item>
                        <Descriptions.Item label="CODmn">
                          {w.codmn} mg/L
                        </Descriptions.Item>
                        <Descriptions.Item label="氨氮">
                          {w.nh3n} mg/L
                        </Descriptions.Item>
                      </Descriptions>
                    ))}
                  </>
                )}
              </Card>
            </Col>

            {/* ═══ Stations ═══ */}
            <Col xs={24} lg={10}>
              <Card
                size="small"
                title={
                  <Space>
                    <EnvironmentOutlined style={{ color: "#F59E0B" }} />
                    监测站点
                  </Space>
                }
                bodyStyle={{ maxHeight: 400, overflow: "auto", padding: 0 }}
              >
                {stations.length === 0 ? (
                  <Empty description="暂无站点数据" className="py-8" />
                ) : (
                  <Table
                    dataSource={stations.map((s, i) => ({ ...s, key: i }))}
                    columns={stationColumns}
                    pagination={false}
                    size="small"
                    showHeader={false}
                  />
                )}
              </Card>
            </Col>
          </Row>
        )}

        {/* ═══ No City Selected ═══ */}
        {!selectedCityData && cities.length > 0 && (
          <Card size="small">
            <div className="text-center py-8 text-gray-400">
              <EnvironmentOutlined className="text-4xl mb-3 opacity-30" />
              <br />
              <Text type="secondary">点击上方城市卡片查看详细环境数据</Text>
            </div>
          </Card>
        )}
        {/* ═══ Agent 状态面板 ═══ */}
        <div className="mt-4">
          <AgentStatusBar compact={false} />
        </div>
      </Spin>
    </div>
  )
}

export default MonitorPage
