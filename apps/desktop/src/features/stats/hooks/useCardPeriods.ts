import { useState } from 'react'
import type { Period } from '../components/PeriodSelector'

export type CardId = 'focus-score' | 'time-distribution' | 'top-sites' | 'heatmap'

export function useCardPeriods(defaultPeriod: Period) {
  const [cardOverrides, setCardOverrides] = useState<Record<CardId, Period | null>>({
    'focus-score': null,
    'time-distribution': null,
    'top-sites': null,
    'heatmap': null,
  })

  const getEffectivePeriod = (cardId: CardId): Period => {
    return cardOverrides[cardId] || defaultPeriod
  }

  const setCardPeriod = (cardId: CardId, period: Period | null) => {
    setCardOverrides((prev) => ({
      ...prev,
      [cardId]: period,
    }))
  }

  return {
    getEffectivePeriod,
    setCardPeriod,
    hasOverride: (cardId: CardId) => cardOverrides[cardId] !== null,
  }
}
