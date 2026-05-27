// @ts-nocheck
/**
 * CesiumPage — Main page component for the Cesium 3D terrain scene.
 *
 * Serves as the route-level page that hosts the HunanTerrainScene
 * component. Provides the full-viewport container and page-level
 * context (e.g., title bar, breadcrumb integration).
 */

import React from 'react';
import HunanTerrainScene from './components/HunanTerrainScene';

/**
 * CesiumPage — Full-screen 3D terrain visualization page for
 * Hunan Province environmental monitoring.
 *
 * The page renders the Cesium scene at full viewport height,
 * filling the content area provided by the MainLayout.
 */
const CesiumPage: React.FC = () => {
  return (
    <div
      style={{
        width: '100%',
        height: 'calc(100vh - 48px)', // Subtract header height
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <HunanTerrainScene />
    </div>
  );
};

export default CesiumPage;
