import { useCompanionDesignVariant } from '../hooks/useCompanionDesignVariant'
import { GlowingOrbCharacter } from './GlowingOrbCharacter'

export function HeroMascot() {
  const { variant } = useCompanionDesignVariant()

  return (
    <div className={`ch-hero-mascot-wrap${variant === 'monk' ? ' ch-hero-mascot-wrap--monk' : ''}`}>
      <GlowingOrbCharacter size={variant === 'monk' ? 200 : 160} variant={variant} />
    </div>
  )
}
