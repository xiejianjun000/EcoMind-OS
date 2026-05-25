/**
 * StationPopup — Info popup displayed when a monitoring station
 * entity is clicked on the Cesium globe.
 */

import React from 'react';
import { Card, Tag, Space, Typography, Divider } from 'antd';
import {
  EnvironmentOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import type { MonitoringStationData } from '../types';
import {
  STATUS_COLOR_MAP,
  STATUS_LABEL_MAP,
  STATION_TYPE_LABEL_MAP,
  STATION_TYPE_COLOR_MAP,
} from '../constants';

const { Text, Title } = Typography;

/** Props for the StationPopup component */
interface StationPopupProps {
  /** The station data to display */
  station: MonitoringStationData;
  /** Callback to close the popup */
  onClose: () => void;
  /** Pixel position on screen for popup placement */
  position: { x: number; y: number };
}

/**
 * StationPopup component — floating card showing station details
 * when a user clicks on a monitoring station marker.
 */
const StationPopup: React.FC<StationPopupProps> = ({
  station,
  onClose,
  position,
}) => {
  const statusColor = STATUS_COLOR_MAP[station.status];
  const typeColor = STATION_TYPE_COLOR_MAP[station.type];

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x + 16,
        top: position.y - 20,
        zIndex: 20,
        pointerEvents: 'auto',
      }}
    >
      <Card
        size="small"
        style={{
          width: 260,
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          borderLeft: `3px solid ${statusColor}`,
        }}
        bodyStyle={{ padding: '10px 14px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Space size={6}>
            <EnvironmentOutlined style={{ color: typeColor, fontSize: 16 }} />
            <Title level={5} style={{ margin: 0, fontSize: 14 }}>
              {station.name}
            </Title>
          </Space>
          <CloseOutlined
            onClick={onClose}
            style={{ cursor: 'pointer', color: '#999', fontSize: 12 }}
          />
        </div>

        <Divider style={{ margin: '8px 0' }} />

        <Space size={8} wrap>
          <Tag color={typeColor}>{STATION_TYPE_LABEL_MAP[station.type]}</Tag>
          <Tag color={statusColor === '#52c41a' ? 'green' : statusColor === '#faad14' ? 'orange' : 'red'}>
            {STATUS_LABEL_MAP[station.status]}
          </Tag>
        </Space>

        {station.description && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {station.description}
            </Text>
          </div>
        )}

        <div style={{ marginTop: 6 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            经度: {station.position[0].toFixed(4)}° | 纬度: {station.position[1].toFixed(4)}°
          </Text>
          {station.elevation !== undefined && (
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
              海拔: {station.elevation}m
            </Text>
          )}
        </div>
      </Card>
    </div>
  );
};

export default StationPopup;
