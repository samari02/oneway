import './CompletionBar.css'

interface CompletionBarProps {
  label: string
  rate: number
  completed: number
  total: number
}

export function CompletionBar({ label, rate, completed, total }: CompletionBarProps) {
  return (
    <div className="completion-bar">
      <div className="completion-bar__header">
        <span className="completion-bar__label">{label}</span>
        <span className="completion-bar__fraction">
          {completed}/{total} days
        </span>
      </div>

      <div className="completion-bar__track">
        <div
          className="completion-bar__fill"
          style={{ width: `${rate}%` }}
        />
      </div>

      <div className="completion-bar__rate">
        {rate}%
      </div>
    </div>
  )
}
