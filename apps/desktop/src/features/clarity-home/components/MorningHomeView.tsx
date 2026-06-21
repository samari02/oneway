import { useAuth } from '@/features/auth'
import { useUserSettings } from '@/features/onboarding'
import { MorningFlowView } from './morning/MorningFlowView'

type MorningHomeViewProps = {
  firstName?: string
}

export function MorningHomeView({ firstName: firstNameProp }: MorningHomeViewProps) {
  const { user } = useAuth()
  const { settings } = useUserSettings(user?.id)
  const firstName = firstNameProp || settings?.display_name?.split(' ')[0] || 'Sam'
  const initialIntention = settings?.north_star_goal?.trim() || ''

  return <MorningFlowView firstName={firstName} initialIntention={initialIntention} />
}
