// @ts-nocheck
/**
 * CoordinateInfo — Displays current mouse position and camera
 * altitude information in the top-right corner of the Cesium scene.
 */

import React from 'react';
import { Card, Space, Typography } from 'antd';
import { AimOutlined, ArrowUpOutlined } from '@ant-design/icons';
import type { CoordinateInfo as CoordinateInfoData } from '../types';

const { Text } = Typography;

/** Props for the CoordinateInfo component */
interface CoordinateInfoProps {
  /** Current coordinate and altitude data */
  info: CoordinateInfoData | null;
}

/**
 * Formats a number to a fixed number of decimal places.
 * @param value - The number to format
 * @param decimals - Number of decimal places
 * @returns Formatted string
 */
function formatNumber(value: number | undefined, decimals: number = 2): string {
  if (value === undefined || value === null) return '--';
  return value.toFixed(decimals);
}

/**
 * CoordinateInfo component — floating card showing cursor position
 * and camera height. Updates in real-time as the user moves the
 * mouse across the Cesium globe.
 */
const CoordinateInfo: React.FC<CoordinateInfoProps> = ({ info }) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        pointerEvents: 'auto',
      }}
    >
      <Card
        size="small"
        style={{
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          minWidth: 160,
        }}
        bodyStyle={{ padding: '8px 12px' }}
      >
        <Space direction="vertical" size={2}>
          <div>
            <Space size={4}>
              <AimOutlined style={{ color: '#1890ff', fontSize: 12 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>经度</Text>
            </Space>
            <div>
              <Text strong style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                {info ? formatNumber(info.longitude, 4) + '°' : '--'}
              </Text>
            </div>
          </div>
          <div>
            <Space size={4}>
              <AimOutlined style={{ color: '#52c41a', fontSize: 12 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>纬度</Text>
            </Space>
            <div>
              <Text strong style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                {info ? formatNumber(info.latitude, 4) + '°' : '--'}
              </Text>
            </div>
          </div>
          <div>
            <Space size={4}>
              <ArrowUpOutlined style={{ color: '#722ed1', fontSize: 12 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>视角高度</Text>
            </Space>
            <div>
              <Text strong style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                {info ? formatHeight(info.cameraHeight) : '--'}
              </Text>
            </div>
          </div>
        </Space>
      </Card>
    </div>
  );
};

/**
 * Formats camera height to a human-readable string.
 * Uses km for heights >= 1000m, otherwise m.
 *
 * @param height - Camera height in meters
 * @returns Formatted height string
 */
function formatHeight(height: number): string {
  if (height >= 1000) {
    return (height / 1000).toFixed(1) + ' km';
  }
  return Math.round(height) + ' m';
}

export default CoordinateInfo;
