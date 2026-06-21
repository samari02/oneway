import { Mascot } from '@/features/mascot'

export function HeroMascot() {
  return (
    <div className="ch-hero-mascot">
      <div className="ch-hero-mascot__glow" aria-hidden />
      <div className="ch-hero-mascot__ring" aria-hidden />
      <div className="ch-hero-mascot__orb">
        <Mascot mood="happy" size="large" showMessage={false} />
      </div>
    </div>
  )
}
