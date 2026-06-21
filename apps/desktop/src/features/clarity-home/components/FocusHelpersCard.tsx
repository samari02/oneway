import { useState } from 'react'
import { MOCK_FOCUS_HELPERS } from '../mock-data'

export function FocusHelpersCard() {
  const [helpers, setHelpers] = useState(MOCK_FOCUS_HELPERS)

  const toggle = (id: string) => {
    setHelpers((prev) =>
      prev.map((h) => (h.id === id ? { ...h, enabled: !h.enabled } : h)),
    )
  }

  return (
    <article className="ch-glass-card ch-helpers-card">
      <h2 className="ch-glass-card__title">Focus helpers</h2>
      <p className="ch-helpers-card__copy">Gentle guardrails while you work.</p>

      <ul className="ch-toggle-list">
        {helpers.map((helper) => (
          <li key={helper.id} className="ch-toggle-row">
            <div className="ch-toggle-row__text">
              <span className="ch-toggle-row__label">{helper.label}</span>
              <span className="ch-toggle-row__desc">{helper.description}</span>
            </div>
            <button
              type="button"
              className={`ch-switch${helper.enabled ? ' ch-switch--on' : ''}`}
              onClick={() => toggle(helper.id)}
              aria-pressed={helper.enabled}
              aria-label={`Toggle ${helper.label}`}
            >
              <span className="ch-switch__thumb" />
            </button>
          </li>
        ))}
      </ul>
    </article>
  )
}
