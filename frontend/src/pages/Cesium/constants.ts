/**
 * Cesium 3D Scene — Constants
 * Scene parameters, monitoring station mock data, color mappings,
 * and configuration values for the Hunan Province 3D terrain view.
 */

import type {
  MonitoringStationData,
  SceneViewParams,
  LayerVisibility,
  StationStatus,
  StationType,
} from './types';

/** Default Cesium ion access token (development placeholder) */
export const CESIUM_TOKEN: string =
  import.meta.env.VITE_CESIUM_TOKEN ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWU2Ny1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6MjU5LCJpYXQiOjE3MDI1NDU0MTJ9.placeholder';

/** TianDiTu API token (development placeholder) */
export const TIAN_DI_TU_TOKEN: string =
  import.meta.env.VITE_TIANDITU_TOKEN ?? 'your_tianditu_token_here';

/** Hunan province GeoJSON boundary URL (Alibaba DataV public data) */
export const HUNAN_BOUNDARY_URL: string =
  'https://geo.datav.aliyun.com/areas_v3/bound/430000_full.json';

/** Default camera view for Hunan Province overview */
export const DEFAULT_SCENE_VIEW: SceneViewParams = {
  latitude: 27.6,
  longitude: 111.7,
  height: 800_000,
  heading: 0,
  pitch: -Math.PI / 2,
  roll: 0,
};

/** Default layer visibility state */
export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  baseImagery: true,
  tianDiTuLabel: true,
  boundary: true,
  monitoringStations: true,
  terrain: true,
};

/**
 * Status-to-color mapping for monitoring station markers.
 * Uses CSS color strings compatible with Cesium Color.fromCssColorString().
 */
export const STATUS_COLOR_MAP: Record<StationStatus, string> = {
  normal: '#52c41a',   // green
  warning: '#faad14',  // amber
  alarm: '#ff4d4f',    // red
};

/**
 * Status display labels (Chinese).
 */
export const STATUS_LABEL_MAP: Record<StationStatus, string> = {
  normal: '正常',
  warning: '预警',
  alarm: '报警',
};

/**
 * Station type display labels (Chinese).
 */
export const STATION_TYPE_LABEL_MAP: Record<StationType, string> = {
  water: '水质',
  air: '空气',
  noise: '噪声',
};

/**
 * Station type icon colors for differentiation.
 */
export const STATION_TYPE_COLOR_MAP: Record<StationType, string> = {
  water: '#1890ff',  // blue
  air: '#722ed1',    // purple
  noise: '#fa8c16',  // orange
};

/**
 * Mock monitoring station data for Hunan Province.
 * Positions are approximate real locations of environmental
 * monitoring stations across Hunan.
 */
export const MONITORING_STATIONS: MonitoringStationData[] = [
  {
    id: 'station-cs-001',
    name: '长沙市空气监测站',
    type: 'air',
    status: 'normal',
    position: [112.9388, 28.2282],
    elevation: 44,
    description: 'PM2.5: 35μg/m³, AQI: 52（良）',
  },
  {
    id: 'station-cs-002',
    name: '湘江水质监测站',
    type: 'water',
    status: 'warning',
    position: [112.9714, 28.1857],
    elevation: 30,
    description: '总磷: 0.25mg/L（轻度超标）',
  },
  {
    id: 'station-zz-001',
    name: '株洲市噪声监测站',
    type: 'noise',
    status: 'normal',
    position: [113.1340, 27.8274],
    elevation: 52,
    description: 'Leq: 54.2dB（达标）',
  },
  {
    id: 'station-xt-001',
    name: '湘潭市空气监测站',
    type: 'air',
    status: 'alarm',
    position: [112.9440, 27.8297],
    elevation: 41,
    description: 'PM2.5: 98μg/m³, AQI: 130（轻度污染）',
  },
  {
    id: 'station-hy-001',
    name: '衡阳湘江水质站',
    type: 'water',
    status: 'normal',
    position: [112.5720, 26.8936],
    elevation: 67,
    description: 'COD: 12mg/L（达标）',
  },
  {
    id: 'station-yb-001',
    name: '岳阳洞庭湖水质站',
    type: 'water',
    status: 'normal',
    position: [113.1290, 29.3572],
    elevation: 22,
    description: '溶解氧: 7.8mg/L（优良）',
  },
  {
    id: 'station-cd-001',
    name: '常德市空气监测站',
    type: 'air',
    status: 'warning',
    position: [111.6986, 29.0318],
    elevation: 35,
    description: 'PM10: 110μg/m³（轻度超标）',
  },
  {
    id: 'station-ld-001',
    name: '娄底市噪声监测站',
    type: 'noise',
    status: 'alarm',
    position: [111.9942, 27.7006],
    elevation: 88,
    description: 'Leq: 72.5dB（超标）',
  },
];
