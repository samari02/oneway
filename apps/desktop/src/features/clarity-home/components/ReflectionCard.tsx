import { MOCK_REFLECTION } from '../mock-data'

export function ReflectionCard() {
  const { prompt, placeholder, streakDays } = MOCK_REFLECTION

  return (
    <article className="ch-glass-card ch-reflection-card">
      <div className="ch-reflection-card__head">
        <h2 className="ch-glass-card__title">End of day reflection</h2>
        <span className="ch-reflection-card__badge">{streakDays} day journal streak</span>
      </div>

      <p className="ch-reflection-card__prompt">{prompt}</p>

      <textarea
        className="ch-reflection-card__input"
        placeholder={placeholder}
        rows={3}
        readOnly
      />

      <button type="button" className="ch-btn ch-btn--primary ch-reflection-card__save">
        Save reflection
      </button>
    </article>
  )
}
