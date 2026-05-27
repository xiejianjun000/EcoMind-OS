/**
 * ChatMapEmbed — 对话气泡中嵌入的地图组件
 *
 * 默认使用 OpenStreetMap (快速加载),
 * 可通过"3D地图"按钮全屏打开 Cesium 页面
 */

import React, { useState } from 'react';
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

const ChatMapEmbed: React.FC<ChatMapProps> = ({
  city,
  lat,
  lng,
  zoom = 12,
  className,
  markers = [],
}) => {
  const [loaded, setLoaded] = useState(false);

  // OpenStreetMap embed URL
  const bbox = `${lng - 0.1},${lat - 0.07},${lng + 0.1},${lat + 0.07}`;
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  // Cesium full-screen URL
  const cesiumUrl = `/map?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&zoom=${zoom}&city=${encodeURIComponent(city)}`;

  return (
    <div className={cn('relative rounded-xl overflow-hidden border bg-gray-100', className)}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent px-3 py-2 flex items-center justify-between">
        <span className="text-white text-xs font-medium flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          {city} · 实时监测点位
        </span>
        <a
          href={cesiumUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/80 text-[10px] hover:text-white underline underline-offset-2"
        >
          全屏3D地图 ↗
        </a>
      </div>

      {/* Loading */}
      {!loaded && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-100">
          <div className="flex flex-col items-center gap-2">
            <div className="h-5 w-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
            <span className="text-xs text-gray-500">加载地图...</span>
          </div>
        </div>
      )}

      {/* OpenStreetMap iframe */}
      <iframe
        src={osmUrl}
        className="w-full h-full min-h-[260px]"
        style={{ border: 0 }}
        title={`${city} 监测地图`}
        onLoad={() => setLoaded(true)}
      />

      {/* Bottom legend */}
      {markers.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
          <div className="flex items-center gap-3 overflow-x-auto">
            {markers.slice(0, 5).map((m, i) => (
              <div key={i} className="flex items-center gap-1.5 shrink-0">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: getAqiColor(m.aqi) }}
                />
                <span className="text-white text-[10px] whitespace-nowrap">
                  {m.name}: {m.aqi}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMapEmbed;
