export type CompanionAvatarId = 'z' | 'jian'

/** Layout tuning for the fixed-size companion orb (see COMPANION_AVATARS.md). */
export type CompanionAvatarLayout = {
  /** Reference orb size used to compute scale (px). Decoupled from actual CSS orb size. */
  refSize: number
  /** Multiplier applied after fit-to-refSize. Higher = more zoom on the model. */
  zoom: number
  /** Pivot X on model bounds (0 = left, 1 = right). */
  anchorX: number
  /** Pivot Y on model bounds (0 = top, 1 = bottom). */
  anchorY: number
  /** Position X as fraction of canvas width (0.5 = centered). */
  faceX: number
  /** Position Y as fraction of canvas height (>1 pushes model down to reveal head). */
  faceY: number
}

export type CompanionAvatarConfig = {
  id: CompanionAvatarId
  label: string
  modelPath: string
  previewSrc: string
  layout: CompanionAvatarLayout
}

export const COMPANION_CORE_PATH = '/v2/1113_v2/live2dcubismcore.min.js'

export const COMPANION_AVATARS: Record<CompanionAvatarId, CompanionAvatarConfig> = {
  z: {
    id: 'z',
    label: 'Z',
    modelPath: '/v2/1113_v2/Z.model3.json',
    previewSrc: '/v2/face_base.png',
    layout: {
      refSize: 140,
      zoom: 1.6,
      anchorX: 0.5,
      anchorY: 0.5,
      faceX: 0.5,
      faceY: 0.65,
    },
  },
  jian: {
    id: 'jian',
    label: '简',
    modelPath: '/v2/jian/简.model3.json',
    previewSrc: '/v2/face_base.png',
    layout: {
      refSize: 140,
      zoom: 8.4,
      anchorX: 0.5,
      anchorY: 0.28,
      faceX: 0.5,
      faceY: 1.18,
    },
  },
}

export const DEFAULT_COMPANION_AVATAR_ID: CompanionAvatarId = 'jian'

export function getCompanionAvatar(id: CompanionAvatarId): CompanionAvatarConfig {
  return COMPANION_AVATARS[id]
}

export function getOtherCompanionAvatarId(id: CompanionAvatarId): CompanionAvatarId {
  return id === 'z' ? 'jian' : 'z'
}
