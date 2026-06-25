import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTaskStore, type Task } from '../../hooks/useTaskStore'
import { useCategoryStore } from '../../hooks/useCategoryStore'
import { useAiPlanner } from '../../hooks/useAiPlanner'
import { PlanStepInput } from './PlanStepInput'
import { PlanStepReview } from './PlanStepReview'

type PlanMyDayStep = 'input' | 'review'

type PlanMyDayViewProps = {
  onClose: () => void
}

export function PlanMyDayView({ onClose }: PlanMyDayViewProps) {
  const [step, setStep] = useState<PlanMyDayStep>('input')
  const [stagedTasks, setStagedTasks] = useState<Task[]>([])
  const [fadeOut, setFadeOut] = useState(false)

  const { tasks: existingTasks, mergeTasks } = useTaskStore()
  const { categories } = useCategoryStore()
  const { isProcessing, error, planFromText, reset } = useAiPlanner(categories)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const existingTitles = useMemo(
    () =>
      new Set(
        existingTasks
          .filter((t) => typeof t.title === 'string')
          .map((t) => t.title.trim().toLowerCase().replace(/\s+/g, ' ')),
      ),
    [existingTasks],
  )

  const handleSubmit = useCallback(
    async (text: string) => {
      try {
        const result = await planFromText(text)
        if (!mountedRef.current || !Array.isArray(result) || result.length === 0) return
        setStagedTasks(result)
        setStep('review')
      } catch {
        // planFromText handles errors internally; guard against unexpected failures
      }
    },
    [planFromText],
  )

  const handleConfirm = useCallback(() => {
    mergeTasks(stagedTasks)
    setFadeOut(true)
    setTimeout(() => {
      reset()
      onClose()
    }, 350)
  }, [stagedTasks, mergeTasks, reset, onClose])

  const handleEdit = useCallback(() => {
    setStep('input')
  }, [])

  return (
    <div className={`pmd-view${fadeOut ? ' pmd-view--fade-out' : ''}`}>
      <button
        type="button"
        className="pmd-view__back"
        onClick={onClose}
        aria-label="Back to dashboard"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="pmd-view__content" key={step}>
        {step === 'input' && (
          <PlanStepInput onSubmit={handleSubmit} isProcessing={isProcessing} error={error} />
        )}
        {step === 'review' && (
          <PlanStepReview
            tasks={stagedTasks}
            categories={categories}
            existingTaskTitles={existingTitles}
            onConfirm={handleConfirm}
            onEdit={handleEdit}
          />
        )}
      </div>
    </div>
  )
}
