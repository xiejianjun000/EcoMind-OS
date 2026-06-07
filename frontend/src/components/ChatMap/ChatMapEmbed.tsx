/**
 * ChatMapEmbed — 对话气泡中嵌入的地图组件
 *
 * 使用 Leaflet (CDN 动态加载) + 高德瓦片（国内秒开），
 * 替代原来的 OpenStreetMap iframe（国内加载极慢/经常超时）。
 * 可通过"3D地图"按钮全屏打开 Cesium 页面。
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ChatMapProps {
  city: string;
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
  markers?: Array<{
    name: string;
    lat: number;
    lng: number;
    aqi: number;
    level: string;
  }>;
}

const getAqiColor = (aqi: number): string => {
  if (aqi <= 50) return '#52c41a';
  if (aqi <= 100) return '#faad14';
  if (aqi <= 150) return '#ff7a45';
  if (aqi <= 200) return '#f5222d';
  if (aqi <= 300) return '#9b1b30';
  return '#780000';
};

// ─── Leaflet CDN 动态加载（按需，不打包） ───
let leafletReady: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (leafletReady) return leafletReady;
  if (typeof window !== 'undefined' && (window as any).L) {
    leafletReady = Promise.resolve();
    return leafletReady;
  }
  leafletReady = new Promise((resolve) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    const loadJs = (url: string, onOk: () => void, onFail: () => void) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = onOk;
      s.onerror = onFail;
      document.head.appendChild(s);
    };

    loadJs(
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
      () => resolve(),
      () => loadJs('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
        () => resolve(),
        () => resolve() // 静默失败，让 initMap 报 error
      )
    );
  });
  return leafletReady;
}

// ─── 瓦片源（默认卫星图 → 高德矢量 → CartoDB 回退） ───
const TILE_PROVIDERS = [
  {
    name: '卫星',
    url: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    opt: { subdomains: ['1','2','3','4'], maxZoom: 18, attribution: '© 高德卫星' },
  },
  {
    name: '矢量',
    url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    opt: { subdomains: ['1','2','3','4'], maxZoom: 18, attribution: '© 高德' },
  },
  {
    name: 'CartoDB',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    opt: { subdomains: 'abcd', maxZoom: 19, attribution: '© CartoDB' },
  },
];

const ChatMapEmbed: React.FC<ChatMapProps> = ({
  city, lat, lng, zoom = 12, className, markers = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const initMap = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      await loadLeaflet();
      const L = (window as any).L;
      if (!L) throw new Error('Leaflet not loaded');

      // 清理旧实例
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      containerRef.current.innerHTML = '';

      const map = L.map(containerRef.current, {
        center: [lat, lng], zoom, zoomControl: true, attributionControl: false,
      });

      // 添加瓦片层（默认卫星图 + 保留引用用于切换）
      const tileLayers: any[] = [];
      TILE_PROVIDERS.forEach((p) => {
        const layer = L.tileLayer(p.url, p.opt);
        if (tileLayers.length === 0) layer.addTo(map); // 默认卫星图
        tileLayers.push(layer);
      });

      // 图层切换控件
      const LayerControl = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function () {
          const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
          div.style.cssText = 'background:#fff;padding:2px;border-radius:4px;box-shadow:0 1px 5px rgba(0,0,0,.2);';
          div.innerHTML = TILE_PROVIDERS.map((p, i) =>
            `<button class="layer-btn" data-i="${i}" style="display:block;width:100%;padding:2px 6px;border:none;background:${i===0?'#e6f7ff':'#fff'};font-size:11px;cursor:pointer;border-radius:2px;white-space:nowrap">${p.name}</button>`
          ).join('');
          L.DomEvent.disableClickPropagation(div);
          setTimeout(() => {
            div.querySelectorAll('.layer-btn').forEach((btn: any) => {
              L.DomEvent.on(btn, 'click', function (e: any) {
                const idx = parseInt(e.target.dataset.i);
                tileLayers.forEach((l, i) => { if (i === idx) l.addTo(map); else map.removeLayer(l); });
                div.querySelectorAll('.layer-btn').forEach((b: any, j: number) => {
                  b.style.background = j === idx ? '#e6f7ff' : '#fff';
                });
              });
            });
          }, 0);
          return div;
        },
      });
      new LayerControl().addTo(map);

      // 城市中心标记
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: '<div style="width:18px;height:18px;background:#1890ff;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>',
          iconSize: [18, 18], iconAnchor: [9, 9],
        }),
      }).bindPopup(`<b>${city}</b><br/>监测中心`).addTo(map);

      // 监测站标记
      markers.forEach((m) => {
        const color = getAqiColor(m.aqi);
        L.marker([m.lat, m.lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:14px;height:14px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
            iconSize: [14, 14], iconAnchor: [7, 7],
          }),
        }).bindPopup(`<b>${m.name}</b><br/>AQI: ${m.aqi} (${m.level})`).addTo(map);
      });

      mapRef.current = map;
      setStatus('ready');
    } catch (err) {
      console.warn('[ChatMap] 加载失败:', err);
      setStatus('error');
    }
  }, [lat, lng, zoom, city, markers]);

  useEffect(() => { initMap(); return () => { mapRef.current?.remove(); mapRef.current = null; }; }, [initMap]);

  const cesiumUrl = `/map?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&zoom=${zoom}&city=${encodeURIComponent(city)}`;

  return (
    <div className={cn('relative rounded-xl overflow-hidden border bg-gray-100', className)}>
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-gradient-to-b from-black/60 to-transparent px-3 py-2 flex items-center justify-between">
        <span className="text-white text-xs font-medium flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />{city} · 实时监测点位
        </span>
        <a href={cesiumUrl} target="_blank" rel="noopener noreferrer" className="text-white/80 text-[10px] hover:text-white underline underline-offset-2">全屏3D地图 ↗</a>
      </div>

      <div ref={containerRef} className="w-full h-[260px]" />

      {status === 'loading' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-100/80">
          <div className="flex flex-col items-center gap-2">
            <div className="h-5 w-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
            <span className="text-xs text-gray-500">加载地图...</span>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-100/90">
          <div className="flex flex-col items-center gap-2">
            <span className="text-lg">🗺️</span>
            <span className="text-xs text-gray-500">地图加载失败</span>
            <button onClick={initMap} className="text-xs text-blue-500 hover:text-blue-600 underline">重试</button>
          </div>
        </div>
      )}

      {markers.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
          <div className="flex items-center gap-3 overflow-x-auto">
            {markers.slice(0, 5).map((m, i) => (
              <div key={i} className="flex items-center gap-1.5 shrink-0">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getAqiColor(m.aqi) }} />
                <span className="text-white text-[10px] whitespace-nowrap">{m.name}: {m.aqi}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMapEmbed;
