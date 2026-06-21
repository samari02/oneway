import { lazy, Suspense } from 'react'
import { Mascot } from '@/features/mascot'
import type { HeroAvatarOption } from '../companion-avatars'
import { HeroCharacterSwitcher } from './HeroCharacterSwitcher'

const Live2DCharacter = lazy(() =>
  import('./Live2DCharacter').then((m) => ({ default: m.Live2DCharacter })),
)

type HeroMascotProps = {
  avatar: HeroAvatarOption
  onCycleAvatar: () => void
}

export function HeroMascot({ avatar, onCycleAvatar }: HeroMascotProps) {
  return (
    <div className="ch-hero-mascot-wrap">
      <div className="ch-hero-mascot">
        <div className="ch-hero-mascot__glow" aria-hidden />
        <div className="ch-hero-mascot__ring" aria-hidden />
        <div className="ch-hero-mascot__orb">
          {avatar.kind === 'mascot' && (
            <Mascot mood="happy" size="large" showMessage={false} />
          )}
          {avatar.kind === 'mascot-bubble' && (
            <Mascot
              mood="happy"
              size="large"
              showMessage
              message={avatar.bubbleMessage ?? 'How was your day?'}
            />
          )}
          {avatar.kind === 'png' && avatar.src && (
            <img
              className="ch-hero-mascot__png"
              src={avatar.src}
              alt={avatar.label}
              draggable={false}
            />
          )}
          {avatar.kind === 'live2d' && (
            <Suspense fallback={<span className="ch-live2d__fallback" aria-hidden>✨</span>}>
              <Live2DCharacter avatar={avatar} className="ch-hero-mascot__live2d" />
            </Suspense>
          )}
        </div>
      </div>
      <HeroCharacterSwitcher current={avatar} onCycle={onCycleAvatar} />
    </div>
  )
}
