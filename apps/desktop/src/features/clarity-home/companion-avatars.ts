/** Hero companion orb image paths (standalone PNG). */
export const HERO_ORB3_SRC = '/companion-avatars/orb3.png'
export const HERO_ORB_FALLBACK_SRC = '/companion-avatars/orb.png'
export const HERO_MONK_SRC = '/companion-avatars/Monk.png'
export const MONK_MINIATURE_SRC = '/companion-avatars/monk_miniature.png'
export const MORNING_BG_SRC = '/companion-avatars/morninghd2.png'

/** Looping ambient track for the morning flow (drop audio in public/companion-avatars/). */
export const MORNING_AMBIENT_AUDIO_SRC =
  import.meta.env.VITE_MORNING_AMBIENT_AUDIO_SRC?.trim() || '/companion-avatars/trimmed.m4a'
