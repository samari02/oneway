import { useState } from 'react'
import { useBoundaryActions } from '../hooks/useBoundaryActions'
import type { Boundary, BoundarySchedule, BoundaryMode } from '@oneway/shared'
import './BoundaryModal.css'

interface EditBoundaryModalProps {
  boundary: Boundary
  onSave: () => void
  onCancel: () => void
}

export function EditBoundaryModal({ boundary, onSave, onCancel }: EditBoundaryModalProps) {
  const { update } = useBoundaryActions()
  const [name, setName] = useState(boundary.name)
  const [patternsText, setPatternsText] = useState(boundary.patterns.join('\n'))
  const [schedule, setSchedule] = useState<BoundarySchedule>(boundary.schedule)
  const [timeStart, setTimeStart] = useState(boundary.time_start || '09:00')
  const [timeEnd, setTimeEnd] = useState(boundary.time_end || '18:00')
  const [mode, setMode] = useState<BoundaryMode>(boundary.mode)
  const [reason, setReason] = useState(boundary.reason || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const patterns = patternsText
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)

    if (!name.trim() || patterns.length === 0) return

    setSaving(true)
    try {
      await update(boundary.id, {
        name: name.trim(),
        patterns,
        schedule,
        time_start: schedule === 'scheduled' ? timeStart : null,
        time_end: schedule === 'scheduled' ? timeEnd : null,
        mode,
        reason: reason.trim() || null,
      })
      onSave()
    } catch (err) {
      console.error('Failed to update boundary:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="boundary-modal__overlay" onClick={onCancel}>
      <div className="boundary-modal" onClick={e => e.stopPropagation()}>
        <header className="boundary-modal__header">
          <h2>Edit Boundary</h2>
          <button className="boundary-modal__close" onClick={onCancel}>×</button>
        </header>

        <form onSubmit={handleSubmit} className="boundary-modal__form">
          {/* Name */}
          <div className="boundary-modal__field">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Social Media"
              autoFocus
            />
          </div>

          {/* Patterns */}
          <div className="boundary-modal__field">
            <label>Sites (one per line)</label>
            <textarea
              value={patternsText}
              onChange={e => setPatternsText(e.target.value)}
              placeholder="twitter.com&#10;x.com&#10;*.reddit.com"
              rows={4}
            />
            <span className="boundary-modal__hint">
              💡 Use *.domain.com for subdomains
            </span>
          </div>

          {/* Schedule */}
          <div className="boundary-modal__field">
            <label>When</label>
            <div className="boundary-modal__radio-group">
              <label className="boundary-modal__radio">
                <input
                  type="radio"
                  name="schedule"
                  checked={schedule === 'always'}
                  onChange={() => setSchedule('always')}
                />
                <span>Always</span>
              </label>
              <label className="boundary-modal__radio">
                <input
                  type="radio"
                  name="schedule"
                  checked={schedule === 'scheduled'}
                  onChange={() => setSchedule('scheduled')}
                />
                <span>Scheduled</span>
              </label>
              <label className="boundary-modal__radio">
                <input
                  type="radio"
                  name="schedule"
                  checked={schedule === 'weekdays'}
                  onChange={() => setSchedule('weekdays')}
                />
                <span>Weekdays</span>
              </label>
              <label className="boundary-modal__radio">
                <input
                  type="radio"
                  name="schedule"
                  checked={schedule === 'weekends'}
                  onChange={() => setSchedule('weekends')}
                />
                <span>Weekends</span>
              </label>
            </div>

            {schedule === 'scheduled' && (
              <div className="boundary-modal__time-range">
                <input
                  type="time"
                  value={timeStart}
                  onChange={e => setTimeStart(e.target.value)}
                />
                <span className="boundary-modal__time-separator">→</span>
                <input
                  type="time"
                  value={timeEnd}
                  onChange={e => setTimeEnd(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Mode */}
          <div className="boundary-modal__field">
            <label>Mode</label>
            <div className="boundary-modal__radio-group boundary-modal__radio-group--mode">
              <label className={`boundary-modal__mode-option ${mode === 'block' ? 'boundary-modal__mode-option--active' : ''}`}>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'block'}
                  onChange={() => setMode('block')}
                />
                <span className="boundary-modal__mode-icon">🚫</span>
                <span className="boundary-modal__mode-label">Block</span>
                <span className="boundary-modal__mode-desc">Redirect to block page</span>
              </label>
              <label className={`boundary-modal__mode-option ${mode === 'awareness' ? 'boundary-modal__mode-option--active' : ''}`}>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'awareness'}
                  onChange={() => setMode('awareness')}
                />
                <span className="boundary-modal__mode-icon">👁️</span>
                <span className="boundary-modal__mode-label">Awareness</span>
                <span className="boundary-modal__mode-desc">Toast notification only</span>
              </label>
            </div>
          </div>

          {/* Reason */}
          <div className="boundary-modal__field">
            <label>Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Focus time - no distractions"
            />
          </div>

          {/* Actions */}
          <div className="boundary-modal__actions">
            <button
              type="button"
              className="boundary-modal__btn boundary-modal__btn--secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="boundary-modal__btn boundary-modal__btn--primary"
              disabled={saving || !name.trim() || !patternsText.trim()}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
