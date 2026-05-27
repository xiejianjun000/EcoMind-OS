/**
 * 监测一张图 — 湖南省环境监测 GIS 大屏
 * 基于 ECharts 5 矢量地图 + 监测站点图层
 * 替代 Cesium 3D（无需 Token / WebGL）
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Row, Col, Card, Tag, Switch, Slider, List, Typography, Select, Space, Button, Segmented,
} from 'antd';
import {
  AimOutlined, HeatMapOutlined, CloudOutlined, ExperimentOutlined,
  SoundOutlined, AlertOutlined, PlayCircleOutlined, PauseCircleOutlined,
  CaretRightOutlined, SettingOutlined,
} from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { MapChart, ScatterChart, EffectScatterChart, LineChart } from 'echarts/charts';
import {
  TooltipComponent, VisualMapComponent, GeoComponent, LegendComponent, GridComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  MapChart, ScatterChart, EffectScatterChart, LineChart,
  TooltipComponent, VisualMapComponent, GeoComponent, LegendComponent, GridComponent,
  CanvasRenderer,
]);

const { Text, Title } = Typography;

// ─── 监测站点模拟数据 ───
interface Station {
  id: string; name: string; city: string; type: 'air' | 'water' | 'noise';
  lng: number; lat: number; value: number; status: 'normal' | 'warning' | 'alarm';
  desc: string;
}

const STATIONS: Station[] = [
  { id: 'cs1', name: '长沙火车站', city: '长沙市', type: 'air', lng: 113.00, lat: 28.22, value: 72, status: 'normal', desc: 'AQI:72 PM2.5:38' },
  { id: 'cs2', name: '湘江长沙段', city: '长沙市', type: 'water', lng: 112.94, lat: 28.18, value: 88, status: 'warning', desc: 'COD:18mg/L 总磷超标' },
  { id: 'zz1', name: '株洲清水塘', city: '株洲市', type: 'air', lng: 113.13, lat: 27.83, value: 68, status: 'normal', desc: 'AQI:68 PM2.5:35' },
  { id: 'xt1', name: '湘潭岳塘', city: '湘潭市', type: 'air', lng: 112.94, lat: 27.83, value: 95, status: 'alarm', desc: 'AQI:130 PM2.5:98 轻度污染' },
  { id: 'hy1', name: '衡阳湘江', city: '衡阳市', type: 'water', lng: 112.57, lat: 26.89, value: 92, status: 'normal', desc: 'COD:12mg/L 达标' },
  { id: 'yy1', name: '岳阳洞庭湖', city: '岳阳市', type: 'water', lng: 113.13, lat: 29.36, value: 75, status: 'normal', desc: '溶解氧:7.8mg/L 优良' },
  { id: 'cd1', name: '常德沅江', city: '常德市', type: 'water', lng: 111.70, lat: 29.03, value: 82, status: 'warning', desc: '总氮:2.1mg/L 轻度超标' },
  { id: 'cz1', name: '郴州三十六湾', city: '郴州市', type: 'air', lng: 113.01, lat: 25.81, value: 62, status: 'normal', desc: 'AQI:62 PM2.5:29' },
  { id: 'ld1', name: '娄底涟钢', city: '娄底市', type: 'noise', lng: 111.99, lat: 27.70, value: 145, status: 'alarm', desc: 'Leq:72.5dB 夜间超标' },
  { id: 'zjj1', name: '张家界天门山', city: '张家界市', type: 'air', lng: 110.48, lat: 29.13, value: 42, status: 'normal', desc: 'AQI:42 PM2.5:18 优' },
  { id: 'yz1', name: '永州潇水', city: '永州市', type: 'water', lng: 111.61, lat: 26.42, value: 90, status: 'normal', desc: 'DO:8.1mg/L 优良' },
  { id: 'hh1', name: '怀化舞水', city: '怀化市', type: 'water', lng: 109.99, lat: 27.57, value: 88, status: 'normal', desc: 'COD:14mg/L 达标' },
  { id: 'sy1', name: '邵阳资江', city: '邵阳市', type: 'water', lng: 111.47, lat: 27.24, value: 85, status: 'normal', desc: '氨氮:0.8mg/L 达标' },
  { id: 'yy2', name: '益阳资江', city: '益阳市', type: 'water', lng: 112.36, lat: 28.58, value: 80, status: 'normal', desc: 'COD:15mg/L 达标' },
  { id: 'xx1', name: '湘西凤凰', city: '湘西土家族苗族自治州', type: 'air', lng: 109.60, lat: 27.95, value: 45, status: 'normal', desc: 'AQI:45 PM2.5:20 优' },
];

type LayerKey = 'aqi' | 'pm25' | 'waterQuality' | 'noise';

const MonitoringMapPage: React.FC = () => {
  const [geoJson, setGeoJson] = useState<any>(null);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    aqi: true, pm25: false, waterQuality: false, noise: false,
  });
  const [timeMode, setTimeMode] = useState<string>('实时');
  const [selectedCity, setSelectedCity] = useState<string | undefined>(undefined);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetch('/geo/hunan.json')
      .then((r) => r.json())
      .then((data) => {
        echarts.registerMap('湖南', data);
        setGeoJson(data);
      })
      .catch(() => setGeoJson({ error: true }));
  }, []);

  // 筛选站点
  const filteredStations = useMemo(() => {
    let list = STATIONS;
    if (selectedCity) list = list.filter((s) => s.city === selectedCity);
    if (layers.aqi) list = list.filter((s) => s.type === 'air');
    if (layers.waterQuality) list = list.filter((s) => s.type === 'water');
    if (layers.noise) list = list.filter((s) => s.type === 'noise');
    // If no layer selected, show all
    const anyLayer = layers.aqi || layers.waterQuality || layers.noise;
    if (!anyLayer) list = STATIONS.filter((s) => selectedCity ? s.city === selectedCity : true);
    return list;
  }, [layers, selectedCity]);

  // 告警站点
  const alertStations = useMemo(() => STATIONS.filter((s) => s.status === 'alarm'), []);

  const statusColor: Record<string, string> = { normal: '#10B981', warning: '#F59E0B', alarm: '#DC2626' };
  const statusLabel: Record<string, string> = { normal: '正常', warning: '预警', alarm: '报警' };

  const scatterData = useMemo(() => filteredStations.map((s) => ({
    name: s.name,
    value: [s.lng, s.lat, s.value],
    status: s.status,
    desc: s.desc,
    city: s.city,
    type: s.type,
    itemStyle: { color: statusColor[s.status] },
  })), [filteredStations]);

  const mapOption = useMemo(() => {
    if (!geoJson || geoJson.error) return null;
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(0,0,0,0.85)',
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (p: any) => {
          if (p.seriesType === 'effectScatter' || p.seriesType === 'scatter') {
            return `<b>${p.name}</b><br/>${p.data.desc || ''}<br/>状态: ${statusLabel[p.data.status]}`;
          }
          return p.name;
        },
      },
      geo: {
        map: '湖南',
        roam: true,
        zoom: 1.15,
        center: [111.7, 27.8],
        scaleLimit: { min: 1, max: 4 },
        label: { show: true, fontSize: 10, color: '#475569' },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: 'bold' },
          itemStyle: { areaColor: '#E2E8F0', borderColor: '#3B82F6', borderWidth: 2 },
        },
        itemStyle: {
          areaColor: '#F1F5F9',
          borderColor: '#CBD5E1',
          borderWidth: 1.5,
          shadowColor: 'rgba(0,0,0,0.08)',
          shadowBlur: 10,
        },
      },
      series: [
        {
          name: '监测站点',
          type: 'effectScatter',
          coordinateSystem: 'geo',
          data: scatterData.filter((d) => d.status === 'alarm'),
          symbolSize: (val: number[]) => Math.max(val[2] / 10, 8),
          showEffectOn: 'render',
          rippleEffect: { brushType: 'stroke', scale: 3, period: 4 },
          label: { show: false },
          itemStyle: { shadowBlur: 6, shadowColor: 'rgba(220,38,38,0.5)' },
          zlevel: 1,
        },
        {
          name: '监测站点',
          type: 'scatter',
          coordinateSystem: 'geo',
          data: scatterData.filter((d) => d.status !== 'alarm'),
          symbolSize: 8,
          label: { show: false },
          emphasis: { scale: 1.8, label: { show: true, formatter: '{b}', fontSize: 11 } },
          zlevel: 1,
        },
      ],
    };
  }, [geoJson, scatterData]);

  const trendOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 10, bottom: 25 },
    xAxis: { type: 'category', data: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '现在'], axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', name: 'AQI', axisLabel: { fontSize: 10 } },
    series: [
      { name: '长沙', type: 'line', data: [58, 52, 65, 78, 72, 68, 72], smooth: true, lineStyle: { color: '#3B82F6' }, itemStyle: { color: '#3B82F6' }, symbol: 'circle', symbolSize: 4 },
      { name: '岳阳', type: 'line', data: [62, 58, 70, 82, 78, 74, 78], smooth: true, lineStyle: { color: '#F59E0B' }, itemStyle: { color: '#F59E0B' }, symbol: 'circle', symbolSize: 4 },
      { name: '全省均值', type: 'line', data: [45, 42, 55, 62, 58, 52, 56], smooth: true, lineStyle: { color: '#10B981', type: 'dashed' }, itemStyle: { color: '#10B981' }, symbol: 'diamond', symbolSize: 4 },
    ],
  }), []);

  const toggleLayer = (key: LayerKey) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!geoJson) return <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>加载地图数据...</div>;
  if (geoJson.error) return <div style={{ padding: 40, textAlign: 'center', color: '#F87171' }}>地图数据加载失败</div>;

  return (
    <div style={{ padding: 16, height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 顶部标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <AimOutlined style={{ marginRight: 8, color: '#00A86B' }} />
          湖南省环境监测一张图
        </Title>
        <Space>
          <Segmented
            size="small"
            value={timeMode}
            onChange={(v) => setTimeMode(v as string)}
            options={['实时', '24h', '7d', '30d']}
          />
          <Tag color="blue">{STATIONS.length} 个监测站点</Tag>
          <Tag color="red">{alertStations.length} 条告警</Tag>
        </Space>
      </div>

      <Row gutter={12} style={{ flex: 1, minHeight: 0 }}>
        {/* 左侧控制面板 */}
        <Col xs={24} lg={5}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
            {/* 图层控制 */}
            <Card size="small" title={<><SettingOutlined /> 数据图层</>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([
                  { key: 'aqi' as LayerKey, label: 'AQI 空气质量', icon: <CloudOutlined />, color: '#3B82F6' },
                  { key: 'waterQuality' as LayerKey, label: '水质监测', icon: <ExperimentOutlined />, color: '#06B6D4' },
                  { key: 'noise' as LayerKey, label: '噪声监测', icon: <SoundOutlined />, color: '#F59E0B' },
                ]).map((layer) => (
                  <div key={layer.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={4}>
                      <span style={{ color: layer.color }}>{layer.icon}</span>
                      <Text style={{ fontSize: 13 }}>{layer.label}</Text>
                    </Space>
                    <Switch size="small" checked={layers[layer.key]} onChange={() => toggleLayer(layer.key)} />
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 4, paddingTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    热力图显示: AQI 指数
                  </Text>
                </div>
              </div>
            </Card>

            {/* 站点筛选 */}
            <Card size="small" title="站点筛选">
              <Select
                placeholder="全部市州"
                value={selectedCity}
                onChange={setSelectedCity}
                allowClear
                size="small"
                style={{ width: '100%' }}
                options={[
                  '长沙市', '株洲市', '湘潭市', '衡阳市', '邵阳市',
                  '岳阳市', '常德市', '张家界市', '益阳市', '郴州市',
                  '永州市', '怀化市', '娄底市', '湘西土家族苗族自治州',
                ].map((c) => ({ value: c, label: c }))}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  显示 {filteredStations.length} 个站点
                </Text>
              </div>
            </Card>

            {/* 告警列表 */}
            <Card
              size="small"
              title={<><AlertOutlined style={{ color: '#DC2626' }} /> 超标预警</>}
              style={{ flex: 1, overflow: 'auto' }}
              bodyStyle={{ padding: '4px 8px', maxHeight: 200, overflow: 'auto' }}
            >
              <List
                size="small"
                dataSource={alertStations}
                renderItem={(item) => (
                  <List.Item style={{ padding: '4px 0', borderBottom: '1px dashed #f0f0f0' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12 }} strong>
                          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor[item.status], marginRight: 4 }} />
                          {item.name}
                        </Text>
                        <Tag color="red" style={{ fontSize: 10, lineHeight: '16px' }}>{statusLabel[item.status]}</Tag>
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>{item.desc}</Text>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </div>
        </Col>

        {/* 中央地图 */}
        <Col xs={24} lg={14}>
          <Card
            size="small"
            bodyStyle={{ padding: 4, height: '100%' }}
            style={{ height: '100%' }}
          >
            <ReactEChartsCore
              echarts={echarts}
              option={mapOption}
              style={{ height: '100%', width: '100%', minHeight: 400 }}
            />
          </Card>
        </Col>

        {/* 右侧信息面板 */}
        <Col xs={24} lg={5}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
            {/* 图例 */}
            <Card size="small" title="站点状态图例">
              <Space direction="vertical" size={4}>
                {Object.entries(statusLabel).map(([key, label]) => (
                  <Space key={key} size={4}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', display: 'inline-block', backgroundColor: statusColor[key] }} />
                    <Text style={{ fontSize: 13 }}>{label}</Text>
                    <Tag>{STATIONS.filter((s) => s.status === key).length}</Tag>
                  </Space>
                ))}
              </Space>
            </Card>

            {/* 时间趋势 */}
            <Card size="small" title="AQI 24h 趋势">
              <ReactEChartsCore echarts={echarts} option={trendOption} style={{ height: 180 }} />
            </Card>

            {/* 底部控制 */}
            <Card size="small" style={{ marginTop: 'auto' }}>
              <div style={{ textAlign: 'center' }}>
                <Button
                  type={playing ? 'default' : 'primary'}
                  icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  size="small"
                  onClick={() => setPlaying(!playing)}
                >
                  {playing ? '暂停' : '播放'}时间序列
                </Button>
              </div>
              <Slider
                size="small"
                defaultValue={100}
                disabled={!playing}
                style={{ marginTop: 8 }}
                tooltip={{ formatter: (v) => `${v}%` }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 10 }}>00:00</Text>
                <Text type="secondary" style={{ fontSize: 10 }}>12:00</Text>
                <Text type="secondary" style={{ fontSize: 10 }}>现在</Text>
              </div>
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default MonitoringMapPage;
