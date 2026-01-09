import { useState } from 'react'
import { StepProblems } from './StepProblems'
import { StepBestSelf } from './StepBestSelf'
import { StepStrictness } from './StepStrictness'
import { StepSetup } from './StepSetup'
import type { OnboardingData } from '../types'
import './OnboardingFlow.css'

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => Promise<void>
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>({
    problems: [],
    wakeTime: '06:00',
    sleepTime: '22:00',
    screenOffTime: '21:00',
    strictness: 'guided',
  })

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }

  const handleNext = () => {
    if (step < 4) {
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
      <div className="onboarding__progress">
        {[1, 2, 3, 4].map(i => (
          <div 
            key={i}
            className={`onboarding__dot ${i === step ? 'onboarding__dot--active' : ''} ${i < step ? 'onboarding__dot--done' : ''}`}
          />
        ))}
      </div>

      <div className="onboarding__content">
        {step === 1 && (
          <StepProblems 
            selected={data.problems}
            onChange={(problems) => updateData({ problems })}
            onNext={handleNext}
          />
        )}

        {step === 2 && (
          <StepBestSelf
            wakeTime={data.wakeTime}
            sleepTime={data.sleepTime}
            screenOffTime={data.screenOffTime}
            onChange={(updates) => updateData(updates)}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {step === 3 && (
          <StepStrictness
            selected={data.strictness}
            onChange={(strictness) => updateData({ strictness })}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {step === 4 && (
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
