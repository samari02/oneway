import { useState } from 'react'
import { StepWelcome } from './StepWelcome'
import { StepProblems } from './StepProblems'
import { StepNorthStar } from './StepNorthStar'
import { StepBestSelf } from './StepBestSelf'
import { StepStrictness } from './StepStrictness'
import { StepSetup } from './StepSetup'
import type { OnboardingData } from '../types'
import './OnboardingFlow.css'

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => Promise<void>
}

const TOTAL_STEPS = 6

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>({
    displayName: '',
    problems: [],
    northStarGoal: '',
    northStarIcon: '🎯',
    wakeTime: '06:00',
    sleepTime: '22:00',
    screenOffTime: '21:00',
    strictness: 'guided',
  })

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleComplete = async () => {
    await onComplete(data)
  }

  return (
    <div className="onboarding">
      {/* Hide progress on welcome screen */}
      {step > 1 && (
        <div className="onboarding__progress">
          {[2, 3, 4, 5, 6].map(i => (
            <div 
              key={i}
              className={`onboarding__dot ${i === step ? 'onboarding__dot--active' : ''} ${i < step ? 'onboarding__dot--done' : ''}`}
            />
          ))}
        </div>
      )}

      <div className="onboarding__content">
        {step === 1 && (
          <StepWelcome onNext={handleNext} />
        )}

        {step === 2 && (
          <StepProblems 
            displayName={data.displayName}
            selected={data.problems}
            onNameChange={(displayName) => updateData({ displayName })}
            onChange={(problems) => updateData({ problems })}
            onNext={handleNext}
          />
        )}

        {step === 3 && (
          <StepNorthStar
            goal={data.northStarGoal}
            icon={data.northStarIcon}
            onChange={(updates) => updateData(updates)}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {step === 4 && (
          <StepBestSelf
            wakeTime={data.wakeTime}
            sleepTime={data.sleepTime}
            screenOffTime={data.screenOffTime}
            onChange={(updates) => updateData(updates)}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {step === 5 && (
          <StepStrictness
            selected={data.strictness}
            onChange={(strictness) => updateData({ strictness })}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {step === 6 && (
          <StepSetup
            data={data}
            onComplete={handleComplete}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  )
}
