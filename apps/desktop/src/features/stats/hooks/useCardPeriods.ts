import { useState, useCallback, useEffect } from 'react'
import type { Period } from '../components/PeriodSelector'

export type CardId = 'focus-score' | 'time-distribution' | 'top-sites' | 'heatmap'

const STORAGE_KEY = 'stats_card_overrides'

const INITIAL_OVERRIDES: Record<CardId, Period | null> = {
  'focus-score': null,
  'time-distribution': null,
  'top-sites': null,
  'heatmap': null,
}

// Load from localStorage
function loadOverrides(): Record<CardId, Period | null> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return { ...INITIAL_OVERRIDES, ...JSON.parse(saved) }
    }
  } catch (e) {
    // Ignore parse errors
  }
  return INITIAL_OVERRIDES
}

export function useCardPeriods(defaultPeriod: Period) {
  const [cardOverrides, setCardOverrides] = useState<Record<CardId, Period | null>>(loadOverrides)

  // Persist to localStorage when overrides change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cardOverrides))
  }, [cardOverrides])

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_OVERRIDES))
  }, [])

  return {
    getEffectivePeriod,
    setCardPeriod,
    resetAllOverrides,
    hasOverride: (cardId: CardId) => cardOverrides[cardId] !== null,
  }
}
