import { useAuth } from '@/features/auth'
import { useUserSettings } from '@/features/onboarding'
import { useDayState } from './hooks/useDayState'
import { UnifiedHomeView } from './components/unified/UnifiedHomeView'

export function ClarityHomeView() {
  const { user } = useAuth()
  const { settings } = useUserSettings(user?.id)
  const { dayState, todayPlan, isLoading, refetch } = useDayState({
    userId: user?.id,
    eveningReflectionTime: settings?.evening_reflection_time ?? '18:00',
  })
  const firstName = settings?.display_name?.split(' ')[0] || 'Sam'
  const initialIntention = settings?.north_star_goal?.trim() || ''

  if (isLoading) {
    return (
      <div className="unified-home">
        <div className="unified-home__shell" />
      </div>
    )
  }

  return (
    <UnifiedHomeView
      firstName={firstName}
      userId={user?.id}
      dayState={dayState}
      todayPlan={todayPlan}
      onRefetch={refetch}
      initialIntention={initialIntention}
    />
  )
}
