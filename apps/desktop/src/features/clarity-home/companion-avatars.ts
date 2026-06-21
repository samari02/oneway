/**
 * Hero companion avatar registry for Clarity Home.
 */

export type HeroAvatarKind = 'mascot' | 'live2d'

export type HeroAvatarOption = {
  id: string
  kind: HeroAvatarKind
  label: string
  /** Live2D model path */
  src?: string
  /** Live2D model key */
  live2dId?: 'asuka' | 'jian'
}

/** All hero avatar options, in cycle order. */
export const HERO_AVATAR_OPTIONS: HeroAvatarOption[] = [
  { id: 'mascot', kind: 'mascot', label: 'Orb' },
  {
    id: 'live2d-asuka',
    kind: 'live2d',
    label: 'Asuka',
    live2dId: 'asuka',
    src: '/v2/asuka/Asuka.model3.json',
  },
  {
    id: 'live2d-jian',
    kind: 'live2d',
    label: 'Jian',
    live2dId: 'jian',
    src: '/v2/jian/简.model3.json',
  },
]

export const HERO_AVATAR_STORAGE_KEY = 'clarity-home-hero-avatar'

export function getHeroAvatarById(id: string): HeroAvatarOption {
  return HERO_AVATAR_OPTIONS.find((a) => a.id === id) ?? HERO_AVATAR_OPTIONS[0]
}
