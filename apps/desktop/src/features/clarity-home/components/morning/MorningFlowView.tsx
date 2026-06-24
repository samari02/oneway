import { MORNING_AMBIENT_AUDIO_SRC } from '../../companion-avatars'
import { useMorningAmbientAudio } from '../../hooks/useMorningAmbientAudio'
import { AmbientMusicPlayer } from '../AmbientMusicPlayer'
import type { DayPlan } from '../../hooks/useMorningFlow'
import { useMorningFlow } from '../../hooks/useMorningFlow'
import './MorningFlow.css'
import { MorningFlowShell } from './MorningFlowShell'
import { MorningStepBlockers } from './MorningStepBlockers'
import { MorningStepConfirm } from './MorningStepConfirm'
import { MorningStepIntention } from './MorningStepIntention'
import { MorningStepPlan } from './MorningStepPlan'

type MorningFlowViewProps = {
  firstName: string
  initialIntention?: string
  initialCarriedForward?: string
  onFlowComplete?: (plan: DayPlan) => void
}

const MONK_MESSAGES: Record<1 | 2 | 3 | 4, string> = {
  1: "What would make today successful? Share freely — I'll help you make it count.",
  2: "Let's shape today together.",
  3: 'What usually gets in the way?',
  4: "I'll help you stay with it.",
}

export function MorningFlowView({
  firstName,
  initialIntention = '',
  initialCarriedForward,
  onFlowComplete,
}: MorningFlowViewProps) {
  const {
    step,
    direction,
    brainDump,
    items,
    priorityItemId,
    blockers,
    suggestedBlockers,
    durationMinutes,
    carriedForwardText,
    showCarriedCard,
    isExtracting,
    setBrainDump,
    setPriorityItemId,
    setIsExtracting,
    applyPlanExtraction,
    updateItem,
    deleteItem,
    addItem,
    confirmPlanStep,
    confirmBlockersStep,
    toggleBlocker,
    carryForwardGoal,
    dismissCarriedGoal,
    removeCarriedForward,
    goToStep,
    goBack,
    completeFlow,
  } = useMorningFlow({ initialIntention, initialCarriedForward })

  const music = useMorningAmbientAudio(MORNING_AMBIENT_AUDIO_SRC)
  const stepClass = `morning-flow__step morning-flow__step--${direction}`

  const handleIntentionContinue = () => {
    goToStep(2, 'forward')
  }

  const handleStartSession = () => {
    const plan = completeFlow()
    onFlowComplete?.(plan)
  }

  return (
    <div className="morning-flow morning-flow--shell">
      <div className="morning-flow__bg" aria-hidden />

      <div className="morning-flow__shell morning-flow__shell--flow">
        {step > 1 && (
          <div className="morning-flow__top-bar morning-flow__top-bar--back">
            <button type="button" className="morning-flow__back-btn" onClick={goBack}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
        )}

        <div className="morning-flow__stage morning-flow__stage--flow">
          <div className={stepClass} key={`step-${step}`}>
            <MorningFlowShell
              firstName={firstName}
              monkMessage={MONK_MESSAGES[step]}
              isProcessing={isExtracting}
            >
              {step === 1 && (
                <MorningStepIntention
                  brainDump={brainDump}
                  carriedForwardText={carriedForwardText}
                  showCarriedCard={showCarriedCard}
                  onBrainDumpChange={setBrainDump}
                  onPlanExtracted={(dump, planItems, meta) => {
                    applyPlanExtraction(dump, planItems, meta)
                  }}
                  onCarryForward={carryForwardGoal}
                  onDismissCarried={dismissCarriedGoal}
                  onRemoveCarriedForward={removeCarriedForward}
                  onContinue={handleIntentionContinue}
                  onExtractingChange={setIsExtracting}
                />
              )}

              {step === 2 && (
                <MorningStepPlan
                  items={items}
                  priorityItemId={priorityItemId}
                  onPrioritySelect={setPriorityItemId}
                  onConfirmPriority={confirmPlanStep}
                  onUpdateItem={updateItem}
                  onDeleteItem={deleteItem}
                  onAddItem={addItem}
                />
              )}

              {step === 3 && (
                <MorningStepBlockers
                  options={suggestedBlockers}
                  selected={blockers}
                  onToggle={toggleBlocker}
                  onContinue={confirmBlockersStep}
                />
              )}

              {step === 4 && (
                <MorningStepConfirm
                  items={items}
                  priorityItemId={priorityItemId}
                  durationMinutes={durationMinutes}
                  blockers={blockers}
                  onStart={handleStartSession}
                />
              )}
            </MorningFlowShell>
          </div>
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
