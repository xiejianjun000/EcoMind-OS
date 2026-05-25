/**
 * Cesium 3D Scene — Type Definitions
 * Defines all TypeScript interfaces and types for the Hunan Province
 * 3D terrain scene, monitoring stations, and layer controls.
 */

/** Monitoring station status levels */
export type StationStatus = 'normal' | 'warning' | 'alarm';

/** Monitoring station environmental type */
export type StationType = 'water' | 'air' | 'noise';

/** Geographic coordinate pair [longitude, latitude] */
export type Coordinate = [number, number];

/**
 * Represents an environmental monitoring station
 * displayed as a marker on the Cesium globe.
 */
export interface MonitoringStationData {
  /** Unique identifier */
  id: string;
  /** Display name of the station */
  name: string;
  /** Environmental monitoring type */
  type: StationType;
  /** Current operational status */
  status: StationStatus;
  /** Geographic position [longitude, latitude] */
  position: Coordinate;
  /** Elevation in meters (optional) */
  elevation?: number;
  /** Brief description or latest reading */
  description?: string;
}

/**
 * Layer visibility state for the layer panel controls.
 * Each key controls visibility of a map layer.
 */
export interface LayerVisibility {
  /** Whether the base imagery layer is visible */
  baseImagery: boolean;
  /** Whether TianDiTu label overlay is visible */
  tianDiTuLabel: boolean;
  /** Whether the Hunan boundary GeoJSON is visible */
  boundary: boolean;
  /** Whether monitoring station markers are visible */
  monitoringStations: boolean;
  /** Whether terrain is enabled */
  terrain: boolean;
}

/**
 * Camera position parameters for the Cesium scene view.
 */
export interface SceneViewParams {
  /** Latitude in degrees */
  latitude: number;
  /** Longitude in degrees */
  longitude: number;
  /** Camera height above terrain in meters */
  height: number;
  /** Heading in radians (0 = north) */
  heading: number;
  /** Pitch in radians (negative = looking down) */
  pitch: number;
  /** Roll in radians */
  roll: number;
}

/**
 * Mouse position information displayed in the coordinate panel.
 */
export interface CoordinateInfo {
  /** Longitude in degrees */
  longitude: number;
  /** Latitude in degrees */
  latitude: number;
  /** Camera height in meters */
  cameraHeight: number;
  /** Terrain elevation at cursor position (meters) */
  elevation?: number;
}
