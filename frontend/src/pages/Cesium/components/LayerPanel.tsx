/**
 * LayerPanel — Floating control panel for toggling Cesium scene layers.
 *
 * Provides checkboxes to show/hide: base imagery, TianDiTu labels,
 * Hunan boundary, monitoring stations, and terrain.
 */

import React from 'react';
import { Card, Checkbox, Divider, Space, Typography } from 'antd';
import {
  GlobalOutlined,
  BorderOutlined,
  EnvironmentOutlined,
  AppstoreOutlined,
  CloudOutlined,
} from '@ant-design/icons';
import type { LayerVisibility } from '../types';

const { Text } = Typography;

/** Props for the LayerPanel component */
interface LayerPanelProps {
  /** Current layer visibility state */
  layers: LayerVisibility;
  /** Callback when a layer's visibility changes */
  onLayerChange: (layers: LayerVisibility) => void;
}

/** Layer configuration items for the panel */
interface LayerItem {
  key: keyof LayerVisibility;
  label: string;
  icon: React.ReactNode;
}

/** Ordered list of toggleable layers */
const LAYER_ITEMS: LayerItem[] = [
  {
    key: 'baseImagery',
    label: '天地图底图',
    icon: <GlobalOutlined />,
  },
  {
    key: 'tianDiTuLabel',
    label: '天地图注记',
    icon: <AppstoreOutlined />,
  },
  {
    key: 'terrain',
    label: '3D 地形',
    icon: <CloudOutlined />,
  },
  {
    key: 'boundary',
    label: '湖南边界',
    icon: <BorderOutlined />,
  },
  {
    key: 'monitoringStations',
    label: '监测站点',
    icon: <EnvironmentOutlined />,
  },
];

/**
 * LayerPanel component — floating card with layer toggle checkboxes.
 * Positioned absolute in the top-left of the Cesium scene.
 */
const LayerPanel: React.FC<LayerPanelProps> = ({ layers, onLayerChange }) => {
  /**
   * Handles checkbox toggle for a specific layer key.
   * @param key - The layer key that was toggled
   */
  const handleToggle = (key: keyof LayerVisibility): void => {
    onLayerChange({
      ...layers,
      [key]: !layers[key],
    });
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 10,
        pointerEvents: 'auto',
      }}
    >
      <Card
        size="small"
        title={
          <Space>
            <AppstoreOutlined />
            <Text strong>图层控制</Text>
          </Space>
        }
        style={{
          width: 180,
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
        bodyStyle={{ padding: '8px 12px' }}
      >
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          {LAYER_ITEMS.map((item, index) => (
            <React.Fragment key={item.key}>
              <Checkbox
                checked={layers[item.key]}
                onChange={() => handleToggle(item.key)}
                style={{ width: '100%' }}
              >
                <Space size={6}>
                  {item.icon}
                  <span style={{ fontSize: 13 }}>{item.label}</span>
                </Space>
              </Checkbox>
              {/* Divider between imagery group and overlay group */}
              {index === 2 && (
                <Divider style={{ margin: '4px 0' }} />
              )}
            </React.Fragment>
          ))}
        </Space>
      </Card>
    </div>
  );
};

export default LayerPanel;
