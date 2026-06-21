import { MOCK_FOCUS_HELPERS } from '../mock-data'

export function FocusHelpersCard() {
  return (
    <article className="ch-glass-card ch-helpers-card">
      <h2 className="ch-glass-card__title">Focus helpers</h2>

      <ul className="ch-helpers-list">
        {MOCK_FOCUS_HELPERS.map((helper) => (
          <li key={helper.id} className="ch-helpers-row">
            <span className="ch-helpers-row__icon" aria-hidden>
              {helper.icon}
            </span>
            <div className="ch-helpers-row__text">
              <span className="ch-helpers-row__label">{helper.label}</span>
              <span className={`ch-helpers-row__detail${helper.active ? ' ch-helpers-row__detail--active' : ''}`}>
                {helper.active && <span className="ch-status-pill__dot" aria-hidden />}
                {helper.detail}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <button type="button" className="ch-btn ch-btn--ghost ch-helpers-card__customize">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
        Customize
      </button>
    </article>
  )
}
