import { useCompanionDesignVariant } from '../hooks/useCompanionDesignVariant'
import { GlowingOrbCharacter } from './GlowingOrbCharacter'

export function HeroMascot() {
  const { variant } = useCompanionDesignVariant()

  return (
    <div className="ch-hero-mascot-wrap">
      <GlowingOrbCharacter size={variant === 'monk' ? 220 : 160} variant={variant} />
    </div>
  )
}
