import { useState, useCallback } from 'react'
import type { Period } from '../components/PeriodSelector'

export type CardId = 'focus-score' | 'time-distribution' | 'top-sites' | 'heatmap'

const INITIAL_OVERRIDES: Record<CardId, Period | null> = {
  'focus-score': null,
  'time-distribution': null,
  'top-sites': null,
  'heatmap': null,
}

export function useCardPeriods(defaultPeriod: Period) {
  const [cardOverrides, setCardOverrides] = useState<Record<CardId, Period | null>>(INITIAL_OVERRIDES)

  const getEffectivePeriod = (cardId: CardId): Period => {
    return cardOverrides[cardId] || defaultPeriod
  }

  const setCardPeriod = (cardId: CardId, period: Period | null) => {
    setCardOverrides((prev) => ({
      ...prev,
      [cardId]: period,
    }))
  }

  // Reset ALL card overrides (called when global period changes)
  const resetAllOverrides = useCallback(() => {
    setCardOverrides(INITIAL_OVERRIDES)
  }, [])

  return {
    getEffectivePeriod,
    setCardPeriod,
    resetAllOverrides,
    hasOverride: (cardId: CardId) => cardOverrides[cardId] !== null,
  }
}
