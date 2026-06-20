export type UiVariant = 'classic' | 'v2'

export function getUiVariant(): UiVariant {
  const value = import.meta.env.VITE_UI_VARIANT?.trim().toLowerCase()
  return value === 'v2' ? 'v2' : 'classic'
}

export const isV2Ui = (): boolean => getUiVariant() === 'v2'

/** Preview the v2 shell without Supabase login (local dev only). */
export const isSkipAuthPreview = (): boolean =>
  import.meta.env.VITE_SKIP_AUTH?.trim().toLowerCase() === 'true'
