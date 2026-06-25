import type { CSSProperties } from 'react'
import { HOME_CHARACTER3_SRC } from '../../companion-avatars'
import './UnifiedHome.css'

type HomeCharacterProps = {
  size?: number
}

export function HomeCharacter({ size = 160 }: HomeCharacterProps) {
  return (
    <div
      className="uh-character"
      style={{ '--uh-character-size': `${size}px` } as CSSProperties}
    >
      <div className="uh-character__glow" aria-hidden />
      <div className="uh-character__particles" aria-hidden />
      <img
        className="uh-character__img"
        src={HOME_CHARACTER3_SRC}
        alt=""
        width={size}
        height={size}
        draggable={false}
      />
    </div>
  )
}
