import { useState } from 'react'
import { MiniMascot } from './MiniMascot'
import './DataSourceCard.css'

interface DataSourceCardProps {
  totalVisits: number
  periodStart?: string
  periodEnd?: string
  lastSync?: string
  isConnected: boolean
  onRefresh?: () => void
}

export function DataSourceCard({
  totalVisits,
  periodStart,
  periodEnd,
  lastSync,
  isConnected,
  onRefresh
}: DataSourceCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return
    
    setIsRefreshing(true)
    await onRefresh()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatLastSync = (dateStr?: string) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div className="data-source-card">
      <div className="data-source-card__header">
        <MiniMascot mood={isConnected ? 'happy' : 'meh'} />
        <span className="data-source-card__title">Data Source</span>
        <span className={`data-source-card__status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🔗 Connected' : '⚠️ Not synced'}
        </span>
      </div>
      
      <div className="data-source-card__stats">
        <div className="data-source-card__stat">
          <span className="data-source-card__stat-label">Visits tracked</span>
          <span className="data-source-card__stat-value">{totalVisits.toLocaleString()}</span>
        </div>
        
        <div className="data-source-card__stat">
          <span className="data-source-card__stat-label">Period</span>
          <span className="data-source-card__stat-value">
            {periodStart && periodEnd 
              ? `${formatDate(periodStart)} – ${formatDate(periodEnd)}`
              : 'No data yet'
            }
          </span>
        </div>
        
        <div className="data-source-card__stat">
          <span className="data-source-card__stat-label">Last sync</span>
          <span className="data-source-card__stat-value">{formatLastSync(lastSync)}</span>
        </div>
      </div>
      
      <button 
        className={`data-source-card__refresh ${isRefreshing ? 'refreshing' : ''}`}
        onClick={handleRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? '↻ Syncing...' : '↻ Refresh'}
      </button>
      
      {!isConnected && (
        <p className="data-source-card__hint">
          Install the Clarity browser extension to sync your browsing history
        </p>
      )}
    </div>
  )
}
