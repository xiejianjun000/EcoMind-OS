/**
 * ScaleBar — Simple map scale bar displayed at the bottom of the
 * Cesium scene. Shows approximate distance representation.
 */

import React, { useEffect, useState } from 'react';
import * as Cesium from 'cesium';
import { Typography } from 'antd';

const { Text } = Typography;

/** Props for the ScaleBar component */
interface ScaleBarProps {
  /** Cesium Viewer instance */
  viewer: Cesium.Viewer | null;
}

/**
 * Calculates the approximate distance represented by a given pixel
 * width at the current camera zoom level.
 *
 * Uses the camera's FOV and height to estimate ground distance.
 *
 * @param viewer - Cesium Viewer instance
 * @param barPixelWidth - Width of the scale bar in pixels
 * @returns Distance in meters
 */
function calculateScaleDistance(
  viewer: Cesium.Viewer,
  barPixelWidth: number = 150,
): number {
  const scene = viewer.scene;
  const camera = scene.camera;
  const canvas = scene.canvas;

  // Use camera height and FOV to estimate ground distance
  const height = camera.positionCartographic.height;
  const frustum = camera.frustum as Cesium.PerspectiveFrustum;
  const fov = frustum.fov ?? Math.PI / 3;
  const canvasWidth = canvas.clientWidth || 1;

  // Approximate: ground distance per pixel at center of screen
  const pixelSize = (2 * height * Math.tan(fov / 2)) / canvasWidth;
  return pixelSize * barPixelWidth;
}

/**
 * Formats a distance in meters to a human-readable string.
 * @param meters - Distance in meters
 * @returns Formatted distance string
 */
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    if (km >= 100) return Math.round(km) + ' km';
    return km.toFixed(km >= 10 ? 0 : 1) + ' km';
  }
  return Math.round(meters) + ' m';
}

/**
 * ScaleBar component — shows a proportional distance indicator
 * at the bottom of the Cesium scene. Updates when the camera moves.
 */
const ScaleBar: React.FC<ScaleBarProps> = ({ viewer }) => {
  const [distance, setDistance] = useState<number>(0);

  useEffect(() => {
    if (!viewer) return;

    const updateScale = (): void => {
      try {
        const dist = calculateScaleDistance(viewer);
        setDistance(dist);
      } catch {
        // Ignore calculation errors during camera transitions
      }
    };

    // Initial calculation
    updateScale();

    // Update on camera movement
    const removeCallback = viewer.camera.changed.addEventListener(updateScale);
    viewer.camera.percentageChanged = 0.1;

    return () => {
      if (removeCallback && typeof removeCallback === 'function') {
        removeCallback();
      }
    };
  }, [viewer]);

  // Fixed bar width in pixels
  const barWidth = 150;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Scale bar line */}
      <div
        style={{
          width: barWidth,
          height: 2,
          backgroundColor: 'rgba(0,0,0,0.6)',
          position: 'relative',
        }}
      >
        {/* Left tick */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: -3,
            width: 1,
            height: 8,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        />
        {/* Right tick */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: -3,
            width: 1,
            height: 8,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        />
      </div>
      {/* Distance label */}
      <Text
        style={{
          fontSize: 11,
          color: 'rgba(0,0,0,0.65)',
          marginTop: 2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {distance > 0 ? formatDistance(distance) : '--'}
      </Text>
    </div>
  );
};

export default ScaleBar;
