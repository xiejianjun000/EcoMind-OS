// @ts-nocheck
/**
 * HunanTerrainScene — Core 3D terrain scene component for
 * Hunan Province using Cesium native API.
 *
 * Handles Cesium Viewer initialization, terrain loading, TianDiTu
 * imagery, Hunan boundary rendering, and camera positioning.
 * Delegates monitoring station rendering to the MonitoringStation
 * sub-component.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import MonitoringStation from './MonitoringStation';
import LayerPanel from './LayerPanel';
import CoordinateInfo from './CoordinateInfo';
import StationPopup from './StationPopup';
import ScaleBar from './ScaleBar';
import type { LayerVisibility, CoordinateInfo as CoordinateInfoData, MonitoringStationData } from '../types';
import {
  CESIUM_TOKEN,
  TIAN_DI_TU_TOKEN,
  HUNAN_BOUNDARY_URL,
  DEFAULT_SCENE_VIEW,
  DEFAULT_LAYER_VISIBILITY,
  MONITORING_STATIONS,
} from '../constants';

// Import Cesium CSS
import 'cesium/Build/Cesium/Widgets/widgets.css';

/** Props for HunanTerrainScene */
interface HunanTerrainSceneProps {
  /** Optional CSS class name for the container */
  className?: string;
}

/**
 * Creates a TianDiTu imagery provider for a given map type.
 *
 * @param type - TianDiTu layer type: 'img' (satellite), 'vec' (vector), 'cia' (annotation), 'ter' (terrain)
 * @param token - TianDiTu API token
 * @returns Cesium.UrlTemplateImageryProvider instance
 */
function createTianDiTuProvider(
  type: string,
  token: string,
): Cesium.UrlTemplateImageryProvider {
  const subdomains = ['0', '1', '2', '3', '4', '5', '6', '7'];
  return new Cesium.UrlTemplateImageryProvider({
    url: `https://t{s}.tianditu.gov.cn/DataServer?T=${type}_w&x={x}&y={y}&l={z}&tk=${token}`,
    subdomains: subdomains,
    maximumLevel: 18,
  });
}

/**
 * Loads Hunan Province boundary GeoJSON and renders it as a
 * yellow/orange semi-transparent outline on the Cesium globe.
 *
 * @param viewer - Cesium Viewer instance
 * @returns Entity array for the boundary features
 */
async function loadHunanBoundary(viewer: Cesium.Viewer): Promise<Cesium.Entity[]> {
  const entities: Cesium.Entity[] = [];

  try {
    const response = await fetch(HUNAN_BOUNDARY_URL);
    if (!response.ok) {
      console.warn(`Failed to load Hunan boundary: ${response.status}`);
      return entities;
    }

    const geoJson = await response.json();

    const dataSource = await Cesium.GeoJsonDataSource.load(geoJson, {
      stroke: Cesium.Color.fromCssColorString('#fa8c16').withAlpha(0.9),
      fill: Cesium.Color.fromCssColorString('#fa8c16').withAlpha(0.08),
      strokeWidth: 2.5,
      clampToGround: true,
    });

    viewer.dataSources.add(dataSource);

    // Collect all entities from the data source
    const entityCollection = dataSource.entities.values;
    for (let i = 0; i < entityCollection.length; i++) {
      entities.push(entityCollection[i]);
    }
  } catch (error) {
    console.warn('Error loading Hunan boundary GeoJSON:', error);
  }

  return entities;
}

/**
 * HunanTerrainScene — Full-featured Cesium 3D terrain scene
 * for Hunan Province environmental monitoring.
 *
 * Manages the Cesium Viewer lifecycle and coordinates all
 * sub-components (layer panel, monitoring stations, coordinate
 * display, scale bar).
 */
const HunanTerrainScene: React.FC<HunanTerrainSceneProps> = ({
  className,
}) => {
  /** Ref to the container div element */
  const containerRef = useRef<HTMLDivElement>(null);
  /** Ref to the Cesium Viewer instance */
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  /** Ref to boundary entities for visibility toggling */
  const boundaryEntitiesRef = useRef<Cesium.Entity[]>([]);
  /** Ref to TianDiTu imagery layers for visibility toggling */
  const baseImageryLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const labelImageryLayerRef = useRef<Cesium.ImageryLayer | null>(null);

  /** Layer visibility state */
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  /** Current coordinate info (from mouse position) */
  const [coordInfo, setCoordInfo] = useState<CoordinateInfoData | null>(null);
  /** Currently selected station for popup display */
  const [selectedStation, setSelectedStation] = useState<MonitoringStationData | null>(null);
  /** Screen position of the selected station */
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  /** Whether the Cesium viewer is initialized */
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  /**
   * Initializes the Cesium Viewer with terrain, imagery, and scene settings.
   * Runs once when the component mounts.
   */
  useEffect(() => {
    if (!containerRef.current) return;

    // Set Cesium ion access token
    Cesium.Ion.defaultAccessToken = CESIUM_TOKEN;

    // Create the Cesium Viewer
    const viewer = new Cesium.Viewer(containerRef.current, {
      // Terrain
      terrain: Cesium.Terrain.fromWorldTerrain({
        requestVertexNormals: true,
        requestWaterMask: true,
      }),

      // Base imagery — use TianDiTu vector map
      baseLayer: false as any, // Disable default Bing Maps

      // UI controls — disable defaults, we use our own
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      navigationHelpButton: false,
      projectionPicker: false,

      // Scene settings
      orderIndependentTranslucency: true,
      contextOptions: {
        webgl: {
          alpha: false,
          antialias: true,
          preserveDrawingBuffer: false,
        },
      },
    });

    // Store viewer reference
    viewerRef.current = viewer;

    // Add TianDiTu base imagery layer (vector map)
    const baseImageryProvider = createTianDiTuProvider('vec', TIAN_DI_TU_TOKEN);
    const baseImageryLayer = viewer.imageryLayers.addImageryProvider(baseImageryProvider);
    baseImageryLayerRef.current = baseImageryLayer;

    // Add TianDiTu annotation/label layer (Chinese place names)
    const labelProvider = createTianDiTuProvider('cia', TIAN_DI_TU_TOKEN);
    const labelLayer = viewer.imageryLayers.addImageryProvider(labelProvider);
    labelImageryLayerRef.current = labelLayer;

    // Set scene properties
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.globe.enableLighting = true;
    viewer.scene.fog.enabled = true;
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
    }

    // Configure anti-aliasing
    if (viewer.scene.postRender) {
      viewer.scene.postProcessStages.fxaa.enabled = true;
    }

    // Fly to Hunan Province default view
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        DEFAULT_SCENE_VIEW.longitude,
        DEFAULT_SCENE_VIEW.latitude,
        DEFAULT_SCENE_VIEW.height,
      ),
      orientation: {
        heading: DEFAULT_SCENE_VIEW.heading,
        pitch: DEFAULT_SCENE_VIEW.pitch,
        roll: DEFAULT_SCENE_VIEW.roll,
      },
      duration: 2,
    });

    // Load Hunan boundary GeoJSON
    loadHunanBoundary(viewer).then((entities) => {
      boundaryEntitiesRef.current = entities;
    });

    // Set up mouse move handler for coordinate display
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        const cartesian = viewer.scene.pickPosition(movement.endPosition);
        if (cartesian) {
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          const longitude = Cesium.Math.toDegrees(cartographic.longitude);
          const latitude = Cesium.Math.toDegrees(cartographic.latitude);
          const cameraHeight = viewer.camera.positionCartographic.height;

          setCoordInfo({
            longitude,
            latitude,
            cameraHeight,
          });
        }
      },
      Cesium.ScreenSpaceEventType.MOUSE_MOVE,
    );

    // Set up click handler for station selection
    handler.setInputAction(
      (click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        const pickedObject = viewer.scene.pick(click.position);
        if (
          Cesium.defined(pickedObject) &&
          pickedObject.id instanceof Cesium.Entity &&
          pickedObject.id.id?.startsWith('monitoring-')
        ) {
          const entityId = pickedObject.id.id;
          const station = MONITORING_STATIONS.find(
            (s) => `monitoring-${s.id}` === entityId,
          );
          if (station) {
            setSelectedStation(station);
            setPopupPosition({ x: click.position.x, y: click.position.y });
          }
        } else {
          setSelectedStation(null);
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK,
    );

    setIsInitialized(true);

    // Cleanup on unmount
    return () => {
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
      setIsInitialized(false);
    };
  }, []);

  /**
   * Syncs layer visibility with Cesium scene elements.
   * Runs whenever the `layers` state changes.
   */
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Toggle base imagery layer
    if (baseImageryLayerRef.current) {
      baseImageryLayerRef.current.show = layers.baseImagery;
    }

    // Toggle TianDiTu label layer
    if (labelImageryLayerRef.current) {
      labelImageryLayerRef.current.show = layers.tianDiTuLabel;
    }

    // Toggle boundary entities
    boundaryEntitiesRef.current.forEach((entity) => {
      entity.show = layers.boundary;
    });

    // Toggle terrain visual effect
    // Note: Cesium Terrain cannot be fully toggled after viewer creation,
    // so we use depth testing against terrain as a visual proxy.
    viewer.scene.globe.depthTestAgainstTerrain = layers.terrain;
  }, [layers]);

  /**
   * Handles layer visibility changes from the LayerPanel.
   * @param newLayers - Updated layer visibility state
   */
  const handleLayerChange = useCallback((newLayers: LayerVisibility): void => {
    setLayers(newLayers);
  }, []);

  /**
   * Handles closing the station popup.
   */
  const handleClosePopup = useCallback((): void => {
    setSelectedStation(null);
  }, []);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Cesium container div */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />

      {/* Overlay UI components — only render after viewer is initialized */}
      {isInitialized && viewerRef.current && (
        <>
          {/* Layer control panel (top-left) */}
          <LayerPanel layers={layers} onLayerChange={handleLayerChange} />

          {/* Coordinate info panel (top-right) */}
          <CoordinateInfo info={coordInfo} />

          {/* Monitoring station entities (no DOM output) */}
          <MonitoringStation
            viewer={viewerRef.current}
            stations={MONITORING_STATIONS}
            visible={layers.monitoringStations}
          />

          {/* Station detail popup */}
          {selectedStation && (
            <StationPopup
              station={selectedStation}
              onClose={handleClosePopup}
              position={popupPosition}
            />
          )}

          {/* Scale bar (bottom center) */}
          <ScaleBar viewer={viewerRef.current} />
        </>
      )}
    </div>
  );
};

export default HunanTerrainScene;
