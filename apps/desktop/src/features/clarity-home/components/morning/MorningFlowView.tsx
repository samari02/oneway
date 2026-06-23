import { useState } from 'react'
import { MORNING_AMBIENT_AUDIO_SRC, MORNING_BG_SRC } from '../../companion-avatars'
import { useMorningAmbientAudio } from '../../hooks/useMorningAmbientAudio'
import { AmbientMusicPlayer } from '../AmbientMusicPlayer'
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
    brainDump,
    items,
    priorityItemId,
    setSuccessFrame,
    setDaySetup,
    setBrainDump,
    setPriorityItemId,
    applyPlanExtraction,
    updateItem,
    deleteItem,
    addItem,
    confirmPriority,
    goForward,
    goBack,
    completeFlow,
  } = useMorningFlow({ initialIntention })

  const music = useMorningAmbientAudio(MORNING_AMBIENT_AUDIO_SRC)

  const stepClass = `morning-flow__step morning-flow__step--${direction}`

  return (
    <div className={`morning-flow${bgFailed ? ' morning-flow--no-bg' : ''}${step === 1 ? ' morning-flow--welcome' : ''}`}>
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

      {step === 1 && (
        <div className="morning-flow__toolbar">
          <button type="button" className="morning-flow__tool-btn" aria-label="Focus mode">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="morning-flow__tool-label">Focus mode</span>
          </button>
          <button type="button" className="morning-flow__tool-btn morning-flow__tool-btn--icon" aria-label="Focus sounds">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </button>
          <button type="button" className="morning-flow__tool-btn morning-flow__tool-btn--icon" aria-label="Notifications">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
        </div>
      )}

      <div className={`morning-flow__shell${step === 1 ? ' morning-flow__shell--welcome' : ''}`}>
        {(step === 2 || step === 3) && (
          <div className="morning-flow__top-bar morning-flow__top-bar--back">
            <button type="button" className="morning-flow__back-btn" onClick={goBack}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
        )}

        <div className={step === 1 ? 'morning-flow__welcome-stage' : 'morning-flow__stage'}>
          {step === 1 && (
            <div className={stepClass} key="step-1">
              <MorningStepIntention
                firstName={firstName}
                brainDump={brainDump}
                items={items}
                priorityItemId={priorityItemId}
                onBrainDumpChange={setBrainDump}
                onPlanExtracted={(dump, planItems, meta) => {
                  applyPlanExtraction(dump, planItems, {
                    summaryFrame: meta.summaryFrame,
                  })
                }}
                onPrioritySelect={setPriorityItemId}
                onConfirmPriority={confirmPriority}
                onUpdateItem={updateItem}
                onDeleteItem={deleteItem}
                onAddItem={addItem}
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

      <div className="morning-flow__music-player-wrap">
        <AmbientMusicPlayer
          tracks={music.tracks}
          currentTrack={music.currentTrack}
          isPlaying={music.isPlaying}
          onToggle={music.toggle}
          onSelectTrack={music.selectTrack}
          onAddTrack={music.addTrack}
          onRemoveTrack={music.removeTrack}
        />
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
