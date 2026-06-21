import { useCallback, useState } from 'react'
import {
  getHeroAvatarById,
  HERO_AVATAR_OPTIONS,
  HERO_AVATAR_STORAGE_KEY,
  type HeroAvatarOption,
} from '../companion-avatars'

function loadSavedAvatarId(): string {
  try {
    const saved = localStorage.getItem(HERO_AVATAR_STORAGE_KEY)
    if (saved && HERO_AVATAR_OPTIONS.some((a) => a.id === saved)) {
      return saved
    }
  } catch {
    /* ignore */
  }
  return HERO_AVATAR_OPTIONS[0]?.id ?? 'mascot'
}

export function useHeroAvatar() {
  const [avatarId, setAvatarId] = useState(loadSavedAvatarId)
  const avatar = getHeroAvatarById(avatarId)

  const cycleAvatar = useCallback(() => {
    setAvatarId((current) => {
      const idx = HERO_AVATAR_OPTIONS.findIndex((a) => a.id === current)
      const next = HERO_AVATAR_OPTIONS[(idx + 1) % HERO_AVATAR_OPTIONS.length]
      try {
        localStorage.setItem(HERO_AVATAR_STORAGE_KEY, next.id)
      } catch {
        /* ignore */
      }
      return next.id
    })
  }, [])

  const selectAvatar = useCallback((option: HeroAvatarOption) => {
    setAvatarId(option.id)
    try {
      localStorage.setItem(HERO_AVATAR_STORAGE_KEY, option.id)
    } catch {
      /* ignore */
    }
  }, [])

  return { avatar, avatarId, cycleAvatar, selectAvatar }
}
