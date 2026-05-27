// @ts-nocheck
/**
 * MonitoringStation — Cesium entity component for environmental
 * monitoring station markers on the 3D globe.
 *
 * Renders billboard + label entities for each station, with color
 * coded by status (normal=green, warning=amber, alarm=red).
 */

import React, { useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import type { MonitoringStationData } from '../types';
import {
  STATUS_COLOR_MAP,
  STATION_TYPE_COLOR_MAP,
} from '../constants';

/** Props for the MonitoringStation component */
interface MonitoringStationProps {
  /** Cesium Viewer instance */
  viewer: Cesium.Viewer;
  /** Array of monitoring station data */
  stations: MonitoringStationData[];
  /** Whether the stations layer is visible */
  visible: boolean;
}

/**
 * Creates a diamond-shaped billboard canvas for station markers.
 * Returns a data URL string suitable for Cesium BillboardGraphics.
 *
 * @param fillColor - CSS color string for the fill
 * @param strokeColor - CSS color string for the border
 * @param size - Canvas size in pixels
 * @returns Data URL of the generated icon
 */
function createStationIcon(
  fillColor: string,
  strokeColor: string,
  size: number = 32,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const half = size / 2;
  const markerHeight = size * 0.85;

  // Draw pin shape (circle on top of a pointed bottom)
  ctx.beginPath();
  ctx.arc(half, half * 0.65, half * 0.5, Math.PI, 0, false);
  ctx.lineTo(half, markerHeight);
  ctx.closePath();

  // Fill
  ctx.fillStyle = fillColor;
  ctx.fill();

  // Stroke
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();

  // Inner circle (white)
  ctx.beginPath();
  ctx.arc(half, half * 0.65, half * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();

  return canvas.toDataURL('image/png');
}

/**
 * MonitoringStation component — renders Cesium entities for
 * environmental monitoring station markers.
 *
 * Uses useRef to track entity collection and useEffect to
 * sync station data with the Cesium Entity API.
 */
const MonitoringStation: React.FC<MonitoringStationProps> = ({
  viewer,
  stations,
  visible,
}) => {
  /** Ref to track added entity IDs for cleanup */
  const entityIdsRef = useRef<string[]>([]);

  /**
   * Adds or removes station entities based on current props.
   * Cleans up previous entities before re-adding.
   */
  const syncEntities = useCallback(() => {
    // Remove existing station entities
    entityIdsRef.current.forEach((id) => {
      const entity = viewer.entities.getById(id);
      if (entity) {
        viewer.entities.remove(entity);
      }
    });
    entityIdsRef.current = [];

    if (!visible) return;

    // Add new station entities
    stations.forEach((station) => {
      const statusColor = STATUS_COLOR_MAP[station.status];
      const typeColor = STATION_TYPE_COLOR_MAP[station.type];
      const iconUrl = createStationIcon(statusColor, '#ffffff', 32);

      const entityId = `monitoring-${station.id}`;

      viewer.entities.add({
        id: entityId,
        name: station.name,
        position: Cesium.Cartesian3.fromDegrees(
          station.position[0],
          station.position[1],
          station.elevation ?? 0,
        ),
        billboard: new Cesium.BillboardGraphics({
          image: iconUrl,
          width: 28,
          height: 28,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        }),
        label: new Cesium.LabelGraphics({
          text: station.name,
          font: '13px sans-serif',
          fillColor: Cesium.Color.fromCssColorString(typeColor),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -34),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: true,
          backgroundColor: new Cesium.Color(0.1, 0.1, 0.1, 0.75),
          backgroundPadding: new Cesium.Cartesian2(6, 4),
        }),
        properties: {
          stationType: station.type,
          stationStatus: station.status,
          description: station.description ?? '',
        } as any,
      });

      entityIdsRef.current.push(entityId);
    });
  }, [viewer, stations, visible]);

  // Sync entities when props change
  useEffect(() => {
    syncEntities();
  }, [syncEntities]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      entityIdsRef.current.forEach((id) => {
        const entity = viewer.entities.getById(id);
        if (entity) {
          viewer.entities.remove(entity);
        }
      });
      entityIdsRef.current = [];
    };
  }, [viewer]);

  // This component has no React DOM output — it operates on Cesium entities
  return null;
};

export default MonitoringStation;
