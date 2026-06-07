/**
 * ForecastChart — 7天空气质量预报趋势图
 * 
 * 自动从后端获取城市预报数据，使用 ECharts 渲染 AQI/PM2.5/O3 趋势。
 */
import React, { useEffect, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { getCityForecast, type ForecastDay } from '@/services/envDataService';

echarts.use([LineChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

interface ForecastChartProps {
  city: string;
  className?: string;
}

const ForecastChart: React.FC<ForecastChartProps> = ({ city, className = '' }) => {
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCityForecast(city).then((data) => {
      if (!cancelled) { setForecast(data); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [city]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-[200px] text-xs text-gray-400 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
          加载预报数据...
        </div>
      </div>
    );
  }

  if (forecast.length === 0) {
    return (
      <div className={`flex items-center justify-center h-[200px] text-xs text-gray-400 ${className}`}>
        暂无预报数据
      </div>
    );
  }

  const dates = forecast.map((d) => d.date.slice(5)); // MM-DD 格式
  const aqiData = forecast.map((d) => d.aqi);
  const pm25Data = forecast.map((d) => d.pm25);
  const o3Data = forecast.map((d) => d.o3);

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const date = forecast[params[0]?.dataIndex]?.date || '';
        let html = `<b>${date}</b><br/>`;
        params.forEach((p: any) => {
          html += `${p.marker} ${p.seriesName}: ${p.value}<br/>`;
        });
        return html;
      },
    },
    legend: {
      data: ['AQI', 'PM2.5', 'O₃'],
      bottom: 0,
      textStyle: { fontSize: 10 },
      itemWidth: 12,
      itemHeight: 8,
    },
    grid: { top: 8, right: 16, bottom: 28, left: 36 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { fontSize: 9, rotate: 30 },
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: 'value',
      name: 'μg/m³ / AQI',
      nameTextStyle: { fontSize: 9 },
      axisLabel: { fontSize: 9 },
      splitLine: { lineStyle: { type: 'dashed', color: '#e8e8e8' } },
    },
    series: [
      {
        name: 'AQI',
        type: 'line',
        data: aqiData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 2, color: '#1890ff' },
        itemStyle: { color: '#1890ff' },
        areaStyle: { color: 'rgba(24,144,255,0.08)' },
      },
      {
        name: 'PM2.5',
        type: 'line',
        data: pm25Data,
        smooth: true,
        symbol: 'diamond',
        symbolSize: 4,
        lineStyle: { width: 1.5, color: '#f5222d', type: 'dashed' },
        itemStyle: { color: '#f5222d' },
      },
      {
        name: 'O₃',
        type: 'line',
        data: o3Data,
        smooth: true,
        symbol: 'triangle',
        symbolSize: 4,
        lineStyle: { width: 1.5, color: '#52c41a', type: 'dashed' },
        itemStyle: { color: '#52c41a' },
      },
    ],
  };

  return (
    <div className={`rounded-lg border bg-white p-2 relative overflow-hidden ${className}`}>
      <div className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
        📈 {city} · 7日预报趋势
      </div>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: 200 }}
        notMerge
        lazyUpdate
      />
    </div>
  );
};

export default ForecastChart;
