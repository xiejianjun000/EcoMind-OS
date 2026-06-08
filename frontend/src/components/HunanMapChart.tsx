/**
 * HunanMapChart — 湖南 14 市州空气质量地图
 *
 * 整合三组官方数据源:
 *   ① 实时 AQI  ──→ 地图热力色 (精确值，每小时更新)
 *   ② 7天预报   ──→ 明日预报线 (范围值，预测区间)
 *   ③ 日排名    ──→ 昨日排名 (日均值，排序比较)
 */
import React, { useEffect, useMemo, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { MapChart } from 'echarts/charts';
import { TooltipComponent, VisualMapComponent, GeoComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([MapChart, TooltipComponent, VisualMapComponent, GeoComponent, CanvasRenderer]);

// ─── 数据接口定义 ───

interface RealtimeItem {
  city: string;
  aqi: number;
  level?: string;
}

interface ForecastItem {
  city: string;
  date: string;
  aqi: string;   // 范围值如 "35-65"
  level: string;  // 如 "优-良"
}

interface RankingItem {
  city: string;
  aqi: number;
  level: string;
  rank: number;
}

// API 用简称 → GeoJSON 用全称的映射
const NAME_MAP: Record<string, string> = {
  '湘西州': '湘西土家族苗族自治州',
};

function toGeoName(name: string): string {
  return NAME_MAP[name] || name;
}

const DEFAULT_MOCK: RealtimeItem[] = [
  { city: '长沙市', aqi: 72 }, { city: '株洲市', aqi: 68 }, { city: '湘潭市', aqi: 75 },
  { city: '衡阳市', aqi: 65 }, { city: '邵阳市', aqi: 58 }, { city: '岳阳市', aqi: 78 },
  { city: '常德市', aqi: 70 }, { city: '张家界市', aqi: 42 }, { city: '益阳市', aqi: 60 },
  { city: '郴州市', aqi: 62 }, { city: '永州市', aqi: 55 }, { city: '怀化市', aqi: 48 },
  { city: '娄底市', aqi: 73 }, { city: '湘西土家族苗族自治州', aqi: 45 },
];

// ─── 组件 ───

interface Props {
  aqiData?: RealtimeItem[];
  forecastData?: ForecastItem[];
  rankingData?: RankingItem[];
}

const HunanMapChart: React.FC<Props> = ({ aqiData, forecastData, rankingData }) => {
  const [geoJson, setGeoJson] = useState<any>(null);

  useEffect(() => {
    fetch('/geo/hunan.json')
      .then((r) => r.json())
      .then((data) => {
        echarts.registerMap('湖南', data);
        setGeoJson(data);
      })
      .catch(() => setGeoJson({ error: true }));
  }, []);

  // 构建查询索引：城市名 → 三组数据
  const dataIndex = useMemo(() => {
    const index: Record<string, {
      now?: { aqi: number; level: string };
      tomorrow?: { aqi: string; level: string };
      yesterday?: { aqi: number; level: string; rank: number };
    }> = {};

    // ① 实时
    (aqiData || DEFAULT_MOCK).forEach((d) => {
      const name = d.city;
      if (!index[name]) index[name] = {};
      index[name].now = { aqi: d.aqi, level: d.level || '' };
    });

    // ② 预报 — 取最近一天的预测
    if (forecastData && forecastData.length > 0) {
      const dates = [...new Set(forecastData.map((d) => d.date))].sort();
      const firstDate = dates[0]; // 明天
      forecastData.filter((d) => d.date === firstDate).forEach((d) => {
        const name = d.city;
        if (!index[name]) index[name] = {};
        index[name].tomorrow = { aqi: d.aqi, level: d.level };
      });
    }

    // ③ 排名
    (rankingData || []).forEach((d) => {
      const name = d.city;
      if (!index[name]) index[name] = {};
      index[name].yesterday = { aqi: d.aqi, level: d.level, rank: d.rank };
    });

    return index;
  }, [aqiData, forecastData, rankingData]);

  const mapOption = useMemo(() => {
    if (!geoJson || geoJson.error) return null;

    // 构建地图 series data
    const seriesData = Object.entries(dataIndex).map(([city, info]) => ({
      name: toGeoName(city),
      value: info.now?.aqi ?? 0,
      nowLevel: info.now?.level ?? '',
      tomorrowAqi: info.tomorrow?.aqi ?? '',
      tomorrowLevel: info.tomorrow?.level ?? '',
      yesterdayAqi: info.yesterday?.aqi ?? 0,
      yesterdayLevel: info.yesterday?.level ?? '',
      yesterdayRank: info.yesterday?.rank ?? 0,
    }));

    const aqiValues = seriesData.filter((d) => d.value > 0).map((d) => d.value);
    const minAqi = aqiValues.length > 0 ? Math.max(0, Math.min(...aqiValues) - 5) : 0;
    const maxAqi = aqiValues.length > 0 ? Math.max(...aqiValues) + 10 : 100;

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15,23,42,0.95)',
        borderColor: '#334155',
        textStyle: { color: '#F1F5F9', fontSize: 12 },
        formatter: (params: any) => {
          if (!params.data || !params.data.value) return '';
          const d = params.data;
          const aqiVal = d.value;
          const aqiColor = aqiVal > 100 ? '#EF4444' : aqiVal > 50 ? '#F59E0B' : '#10B981';

          let html = `<div style="padding:4px 0">
            <strong style="font-size:14px;color:#F8FAFC">${d.name}</strong>`;

          // ① 现在 — 大号显示
          html += `<div style="margin:6px 0">
            <span style="color:#94A3B8;font-size:11px">● 现在 </span>
            <span style="color:${aqiColor};font-size:18px;font-weight:bold">AQI ${aqiVal}</span>
            <span style="color:${aqiColor};margin-left:4px">${d.nowLevel || ''}</span>
          </div>`;

          // ② 明天预报
          if (d.tomorrowAqi) {
            const tc = d.tomorrowLevel?.includes('轻') ? '#F97316' :
                      d.tomorrowLevel?.includes('良') ? '#F59E0B' : '#10B981';
            html += `<div style="margin:3px 0">
              <span style="color:#64748B;font-size:11px">○ 明天 </span>
              <span style="color:${tc}">AQI ${d.tomorrowAqi} ${d.tomorrowLevel || ''}</span>
            </div>`;
          }

          // ③ 昨日排名
          if (d.yesterdayRank > 0) {
            const yc = d.yesterdayAqi > 50 ? '#F59E0B' : '#10B981';
            html += `<div style="margin:3px 0">
              <span style="color:#64748B;font-size:11px">○ 昨日 </span>
              <span style="color:${yc}">AQI ${d.yesterdayAqi} ${d.yesterdayLevel || ''}</span>
              <span style="color:#FBBF24;margin-left:4px">#${d.yesterdayRank}</span>
            </div>`;
          }

          html += '</div>';
          return html;
        },
      },
      visualMap: {
        min: minAqi,
        max: maxAqi,
        text: ['AQI ↑', 'AQI ↓'],
        realtime: false,
        calculable: true,
        inRange: { color: ['#10B981', '#84CC16', '#FCD34D', '#F97316', '#EF4444', '#991B1B'] },
        textStyle: { color: '#94A3B8', fontSize: 10 },
        left: 8,
        bottom: 8,
        itemWidth: 10,
        itemHeight: 80,
      },
      series: [{
        name: '湖南',
        type: 'map',
        map: '湖南',
        roam: true,
        zoom: 1.1,
        center: [111.7, 27.8],
        scaleLimit: { min: 1, max: 3 },
        label: {
          show: true,
          fontSize: 10,
          color: '#fff',
          textShadowColor: 'rgba(0,0,0,0.7)',
          textShadowBlur: 2,
        },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#0F172A' },
          itemStyle: { areaColor: '#FCD34D', borderColor: '#fff', borderWidth: 2 },
        },
        itemStyle: {
          borderColor: 'rgba(255,255,255,0.6)',
          borderWidth: 1.5,
          areaColor: '#1E293B',
        },
        data: seriesData,
      }],
    };
  }, [geoJson, dataIndex]);

  if (!geoJson) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8' }}>
        加载地图数据...
      </div>
    );
  }

  if (geoJson.error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#F87171' }}>
        地图数据加载失败
      </div>
    );
  }

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={mapOption}
      style={{ height: '100%', width: '100%' }}
    />
  );
};

export default HunanMapChart;
