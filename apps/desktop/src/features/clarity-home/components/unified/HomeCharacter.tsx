import type { CSSProperties } from 'react'
import { HOME_CHARACTER3_SRC } from '../../companion-avatars'
import './UnifiedHome.css'

type HomeCharacterProps = {
  size?: number
  nodding?: boolean
}

export function HomeCharacter({ size = 160, nodding = false }: HomeCharacterProps) {
  return (
    <div
      className="uh-character"
      style={{ '--uh-character-size': `${size}px` } as CSSProperties}
    >
      <div className="uh-character__glow" aria-hidden />
      <div className="uh-character__particles" aria-hidden />
      <div className="uh-character__stars" aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <img
        className={`uh-character__img${nodding ? ' uh-character__img--nod' : ''}`}
        src={HOME_CHARACTER3_SRC}
        alt=""
        width={size}
        height={size}
        draggable={false}
      />
    </div>
  )
}
