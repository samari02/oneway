import { useState, useEffect } from 'react'

export interface SiteVisit {
  domain: string
  visits: number
  timeSpent: number // in minutes
  category: 'productive' | 'neutral' | 'distraction'
}

export interface DailyFocusScore {
  date: string
  score: number // 0-100
}

export interface BrowsingStats {
  focusScore: number
  focusTrend: 'up' | 'down' | 'stable'
  timeDistribution: {
    productive: number // percentage
    neutral: number
    distraction: number
  }
  topSites: SiteVisit[]
  dailyScores: DailyFocusScore[]
  totalVisits: number
  totalTimeTracked: number // in minutes
}

// Mock data for now - will be replaced with native messaging data
const MOCK_STATS: BrowsingStats = {
  focusScore: 73,
  focusTrend: 'up',
  timeDistribution: {
    productive: 45,
    neutral: 35,
    distraction: 20
  },
  topSites: [
    { domain: 'github.com', visits: 142, timeSpent: 180, category: 'productive' },
    { domain: 'twitter.com', visits: 89, timeSpent: 95, category: 'distraction' },
    { domain: 'google.com', visits: 67, timeSpent: 45, category: 'neutral' },
    { domain: 'notion.so', visits: 52, timeSpent: 120, category: 'productive' },
    { domain: 'youtube.com', visits: 34, timeSpent: 85, category: 'distraction' },
    { domain: 'stackoverflow.com', visits: 28, timeSpent: 40, category: 'productive' },
    { domain: 'reddit.com', visits: 24, timeSpent: 55, category: 'distraction' },
    { domain: 'figma.com', visits: 18, timeSpent: 90, category: 'productive' },
    { domain: 'linkedin.com', visits: 12, timeSpent: 15, category: 'neutral' },
    { domain: 'slack.com', visits: 8, timeSpent: 60, category: 'productive' },
  ],
  dailyScores: generateLast30DaysScores(),
  totalVisits: 474,
  totalTimeTracked: 785
}

function generateLast30DaysScores(): DailyFocusScore[] {
  const scores: DailyFocusScore[] = []
  const today = new Date()
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    
    // Generate somewhat realistic scores with some variance
    const baseScore = 65 + Math.sin(i / 3) * 15
    const randomVariance = (Math.random() - 0.5) * 20
    const score = Math.max(0, Math.min(100, Math.round(baseScore + randomVariance)))
    
    scores.push({
      date: date.toISOString().split('T')[0],
      score
    })
  }
  
  return scores
}

export function useBrowsingStats(userId?: string) {
  const [stats, setStats] = useState<BrowsingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      setError(null)

      try {
        // TODO: Replace with actual native messaging call
        // const response = await invoke('get_browsing_stats', { userId })
        
        // For now, use mock data with a small delay to simulate loading
        await new Promise(resolve => setTimeout(resolve, 300))
        setStats(MOCK_STATS)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch browsing stats'))
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [userId])

  return { stats, loading, error }
}
