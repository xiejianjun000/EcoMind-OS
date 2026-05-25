/// <reference types="vite/client" />

/** Environment variable type declarations for EcoMind OS */
interface ImportMetaEnv {
  /** Cesium ion access token */
  readonly VITE_CESIUM_TOKEN: string;
  /** TianDiTu map API token */
  readonly VITE_TIANDITU_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
