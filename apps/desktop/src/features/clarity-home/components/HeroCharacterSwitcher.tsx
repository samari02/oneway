import { HERO_AVATAR_OPTIONS } from '../companion-avatars'
import type { HeroAvatarOption } from '../companion-avatars'

type HeroCharacterSwitcherProps = {
  current: HeroAvatarOption
  onCycle: () => void
}

export function HeroCharacterSwitcher({ current, onCycle }: HeroCharacterSwitcherProps) {
  const currentIndex = HERO_AVATAR_OPTIONS.findIndex((a) => a.id === current.id)

  return (
    <div className="ch-hero-switcher">
      <button
        type="button"
        className="ch-hero-switcher__btn"
        onClick={onCycle}
        aria-label={`Switch companion character. Current: ${current.label}. ${HERO_AVATAR_OPTIONS.length} available.`}
        title={`Switch character (${current.label})`}
      >
        <span className="ch-hero-switcher__icon" aria-hidden>
          ↻
        </span>
        <span className="ch-hero-switcher__label">{current.label}</span>
      </button>
      <div className="ch-hero-switcher__dots" aria-hidden>
        {HERO_AVATAR_OPTIONS.map((opt, i) => (
          <span
            key={opt.id}
            className={`ch-hero-switcher__dot${i === currentIndex ? ' ch-hero-switcher__dot--active' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
