import { useState } from 'react'
import { MORNING_BG_SRC } from '../../companion-avatars'
import { useMorningFlow } from '../../hooks/useMorningFlow'
import './MorningFlow.css'
import { MorningStepIntention } from './MorningStepIntention'
import { MorningStepSetup } from './MorningStepSetup'
import { MorningStepSuccess } from './MorningStepSuccess'

type MorningFlowViewProps = {
  firstName: string
  initialIntention?: string
}

export function MorningFlowView({ firstName, initialIntention = '' }: MorningFlowViewProps) {
  const [bgFailed, setBgFailed] = useState(false)

  const {
    step,
    direction,
    intention,
    successFrame,
    daySetup,
    setIntention,
    setSuccessFrame,
    setDaySetup,
    submitIntention,
    goForward,
    completeFlow,
  } = useMorningFlow({ initialIntention })

  const stepClass = `morning-flow__step morning-flow__step--${direction}${step === 3 ? ' morning-flow__step--wide' : ''}`

  return (
    <div className={`morning-flow${bgFailed ? ' morning-flow--no-bg' : ''}`}>
      <div className="morning-flow__bg" aria-hidden>
        {!bgFailed && (
          <img
            className="morning-flow__bg-img"
            src={MORNING_BG_SRC}
            alt=""
            onError={() => setBgFailed(true)}
          />
        )}
      </div>

      <div className="morning-flow__shell">
        <div className="morning-flow__top-bar">
          {step === 1 && (
            <button type="button" className="morning-flow__link">
              Why this matters
            </button>
          )}
        </div>

        <div className="morning-flow__stage">
          {step === 1 && (
            <div className={stepClass} key="step-1">
              <MorningStepIntention
                firstName={firstName}
                intention={intention}
                onIntentionChange={setIntention}
                onSubmit={submitIntention}
              />
            </div>
          )}

          {step === 2 && (
            <div className={stepClass} key="step-2">
              <MorningStepSuccess
                intention={intention}
                successFrame={successFrame}
                onSelect={setSuccessFrame}
                onContinue={goForward}
              />
            </div>
          )}

          {step === 3 && (
            <div className={stepClass} key="step-3">
              <MorningStepSetup
                daySetup={daySetup}
                onToggle={setDaySetup}
                onComplete={completeFlow}
              />
            </div>
          )}
        </div>
      </div>

      <div className="morning-flow__mood-chip">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
        </svg>
        Peaceful morning
      </div>
    </div>
  )
}
