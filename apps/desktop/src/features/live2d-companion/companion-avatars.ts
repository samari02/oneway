export type CompanionAvatarId = 'z' | 'jian' | 'asuka'

/** Layout tuning for the companion orb (see COMPANION_AVATARS.md). */
export type CompanionAvatarLayout = {
  refSize: number
  zoom: number
  anchorX: number
  anchorY: number
  faceX: number
  faceY: number
}

export type CompanionAvatarConfig = {
  id: CompanionAvatarId
  label: string
  modelPath: string
  previewSrc: string
  layout: CompanionAvatarLayout
}

export const COMPANION_CORE_PATH = '/companion/core/live2dcubismcore.min.js'

export const COMPANION_AVATAR_ORDER: CompanionAvatarId[] = ['z', 'jian', 'asuka']

export const COMPANION_AVATARS: Record<CompanionAvatarId, CompanionAvatarConfig> = {
  z: {
    id: 'z',
    label: 'Z',
    modelPath: '/companion/z/Z.model3.json',
    previewSrc: '/companion/jian/简.png',
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
    modelPath: '/companion/jian/简.model3.json',
    previewSrc: '/companion/jian/简.png',
    layout: {
      refSize: 140,
      zoom: 8.4,
      anchorX: 0.5,
      anchorY: 0.28,
      faceX: 0.5,
      faceY: 1.18,
    },
  },
  asuka: {
    id: 'asuka',
    label: 'Asuka',
    modelPath: '/companion/asuka/Asuka.model3.json',
    previewSrc: '/companion/asuka/ICON.PNG',
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

export function getNextCompanionAvatarId(id: CompanionAvatarId): CompanionAvatarId {
  const index = COMPANION_AVATAR_ORDER.indexOf(id)
  const next = (index + 1) % COMPANION_AVATAR_ORDER.length
  return COMPANION_AVATAR_ORDER[next]
}
