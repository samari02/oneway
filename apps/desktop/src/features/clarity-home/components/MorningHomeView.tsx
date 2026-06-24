import { useAuth } from '@/features/auth'
import { useUserSettings } from '@/features/onboarding'
import { syncMorningFlowPlan } from '../api/dailyPlans'
import type { DayPlan } from '../hooks/useMorningFlow'
import { MorningFlowView } from './morning/MorningFlowView'

type MorningHomeViewProps = {
  firstName?: string
  onFlowComplete?: () => void
}

export function MorningHomeView({ firstName: firstNameProp, onFlowComplete }: MorningHomeViewProps) {
  const { user } = useAuth()
  const { settings } = useUserSettings(user?.id)
  const firstName = firstNameProp || settings?.display_name?.split(' ')[0] || 'Sam'
  const initialIntention = settings?.north_star_goal?.trim() || ''

  const handleFlowComplete = async (plan: DayPlan) => {
    if (user) {
      await syncMorningFlowPlan(user.id, plan)
    }
    onFlowComplete?.()
  }

  return (
    <MorningFlowView
      firstName={firstName}
      initialIntention={initialIntention}
      onFlowComplete={handleFlowComplete}
    />
  )
}
