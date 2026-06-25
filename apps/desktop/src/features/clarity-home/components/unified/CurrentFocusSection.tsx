import {
  FOCUS_DURATION_PRESETS,
  formatFocusCountdown,
  useCurrentFocus,
  type FocusDurationMinutes,
} from '../../hooks/useCurrentFocus'

function TargetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  )
}

function FocusTimerRing({
  remainingSeconds,
  totalSeconds,
  running,
}: {
  remainingSeconds: number
  totalSeconds: number
  running: boolean
}) {
  const size = 88
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0
  const offset = circumference * (1 - progress)

  return (
    <div className="uh-dash-focus__ring-wrap">
      <span className="uh-dash-focus__ring-label">
        {running ? 'Time left' : 'Focus timer'}
      </span>
      <svg className="uh-dash-focus__ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="uh-dash-focus__ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className={`uh-dash-focus__ring-fill${running ? ' uh-dash-focus__ring-fill--active' : ''}`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="uh-dash-focus__ring-stats">
        <span className="uh-dash-focus__ring-value uh-dash-focus__ring-value--timer">
          {formatFocusCountdown(remainingSeconds)}
        </span>
      </div>
    </div>
  )
}

export function CurrentFocusSection() {
  const {
    taskTitle,
    durationMinutes,
    status,
    remainingSeconds,
    setDuration,
    startTimer,
    stopTimer,
    clearFocus,
    dismissFinished,
  } = useCurrentFocus()

  const totalSeconds = durationMinutes * 60
  const isRunning = status === 'running'
  const isFinished = status === 'finished'
  const hasTask = Boolean(taskTitle)

  const handlePresetClick = (minutes: FocusDurationMinutes) => {
    setDuration(minutes)
    if (hasTask && !isRunning) {
      startTimer(minutes)
    }
  }

  return (
    <section className="uh-dash-focus" aria-label="Current focus">
      <span className="uh-dash-section-label">Current Focus</span>
      <div className={`uh-dash-focus__card${isRunning ? ' uh-dash-focus__card--running' : ''}${isFinished ? ' uh-dash-focus__card--finished' : ''}`}>
        <div className="uh-dash-focus__main">
          {hasTask ? (
            <>
              <div className="uh-dash-focus__task">
                <span className="uh-dash-focus__task-icon" aria-hidden>
                  <TargetIcon />
                </span>
                <p className="uh-dash-focus__task-title">{taskTitle}</p>
              </div>
              <div className="uh-dash-focus__meta">
                {isFinished ? (
                  <span className="uh-dash-focus__status uh-dash-focus__status--done">
                    Focus session complete
                  </span>
                ) : isRunning ? (
                  <span className="uh-dash-focus__status uh-dash-focus__status--running">
                    <span className="uh-dash-focus__status-dot" aria-hidden />
                    In progress
                  </span>
                ) : (
                  <span className="uh-dash-focus__status">Choose a duration to start</span>
                )}
              </div>
              {!isFinished && (
                <div className="uh-dash-focus__presets" role="group" aria-label="Focus duration">
                  {FOCUS_DURATION_PRESETS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      className={`uh-dash-focus__preset${durationMinutes === minutes ? ' uh-dash-focus__preset--active' : ''}`}
                      disabled={!hasTask}
                      onClick={() => handlePresetClick(minutes)}
                    >
                      {minutes}m
                    </button>
                  ))}
                </div>
              )}
              <div className="uh-dash-focus__controls">
                {isRunning ? (
                  <button type="button" className="uh-dash-focus__control-btn" onClick={stopTimer}>
                    Stop
                  </button>
                ) : isFinished ? (
                  <>
                    <button type="button" className="uh-dash-focus__control-btn uh-dash-focus__control-btn--primary" onClick={dismissFinished}>
                      Done
                    </button>
                    <button
                      type="button"
                      className="uh-dash-focus__control-btn"
                      onClick={() => startTimer(durationMinutes)}
                    >
                      Start again
                    </button>
                  </>
                ) : hasTask ? (
                  <>
                    <button
                      type="button"
                      className="uh-dash-focus__control-btn uh-dash-focus__control-btn--primary"
                      onClick={() => startTimer(durationMinutes)}
                    >
                      Start focus
                    </button>
                    <button type="button" className="uh-dash-focus__control-btn" onClick={clearFocus}>
                      Clear
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <div className="uh-dash-focus__empty">
              <p className="uh-dash-focus__empty-title">No task selected</p>
              <p className="uh-dash-focus__empty-hint">
                Pick a task from Open Tasks and tap the focus button to begin.
              </p>
            </div>
          )}
        </div>
        {hasTask && (
          <FocusTimerRing
            remainingSeconds={remainingSeconds}
            totalSeconds={totalSeconds}
            running={isRunning}
          />
        )}
      </div>
    </section>
  )
}
