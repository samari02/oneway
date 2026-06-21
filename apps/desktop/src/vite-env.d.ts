/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Rive file declarations
declare module '*.riv' {
  const src: string
  export default src
}

interface Window {
  Live2DCubismCore?: unknown
  PIXI?: typeof import('pixi.js')
}
