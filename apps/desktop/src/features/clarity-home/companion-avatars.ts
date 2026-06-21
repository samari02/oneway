/**
 * Hero companion avatar registry for Clarity Home.
 * PNGs are auto-discovered from public/companion-avatars/ via Vite glob.
 */

const pngModules = import.meta.glob(
  '../../../public/companion-avatars/*.png',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

function filenameToLabel(path: string): string {
  const base = path.split('/').pop()?.replace(/\.png$/i, '') ?? 'Avatar'
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function filenameToId(path: string): string {
  return path.split('/').pop()?.replace(/\.png$/i, '').toLowerCase() ?? 'avatar'
}

export type HeroAvatarKind = 'mascot' | 'mascot-bubble' | 'png' | 'live2d'

export type HeroAvatarOption = {
  id: string
  kind: HeroAvatarKind
  label: string
  /** PNG url or Live2D model path */
  src?: string
  /** Live2D model key */
  live2dId?: 'asuka' | 'jian'
  bubbleMessage?: string
}

const BUILTIN_AVATARS: HeroAvatarOption[] = [
  { id: 'mascot', kind: 'mascot', label: 'Orb' },
  {
    id: 'mascot-bubble',
    kind: 'mascot-bubble',
    label: 'Bubble',
    bubbleMessage: 'How was your day?',
  },
]

const LIVE2D_AVATARS: HeroAvatarOption[] = [
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

const pngAvatars: HeroAvatarOption[] = Object.entries(pngModules).map(([path, url]) => ({
  id: `png-${filenameToId(path)}`,
  kind: 'png' as const,
  label: filenameToLabel(path),
  src: url,
}))

/** All hero avatar options, in cycle order. */
export const HERO_AVATAR_OPTIONS: HeroAvatarOption[] = [
  ...BUILTIN_AVATARS,
  ...pngAvatars,
  ...LIVE2D_AVATARS,
]

export const HERO_AVATAR_STORAGE_KEY = 'clarity-home-hero-avatar'

export function getHeroAvatarById(id: string): HeroAvatarOption {
  return HERO_AVATAR_OPTIONS.find((a) => a.id === id) ?? HERO_AVATAR_OPTIONS[0]
}
