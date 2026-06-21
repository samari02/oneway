import { useId, type CSSProperties } from 'react'
import './GlowingOrbCharacter.css'

interface GlowingOrbCharacterProps {
  /** Total visual height in px (sphere + ring + bloom). */
  size?: number
  className?: string
}

export function GlowingOrbCharacter({ size = 160, className }: GlowingOrbCharacterProps) {
  const uid = useId().replace(/:/g, '')
  const sphere = Math.round(size * 0.55)
  const ringW = Math.round(sphere * 0.52)

  return (
    <div
      className={`glowing-orb${className ? ` ${className}` : ''}`}
      style={{ '--orb-size': `${size}px`, '--orb-sphere': `${sphere}px`, '--orb-ring-w': `${ringW}px` } as CSSProperties}
      role="img"
      aria-label="Companion orb"
    >
      <div className="glowing-orb__stars" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} />
        ))}
      </div>

      {/* Diffuse purple halo behind everything */}
      <div className="glowing-orb__halo" aria-hidden />

      <div className="glowing-orb__body">
        <div className="glowing-orb__sphere-wrap">
          <div className="glowing-orb__sphere">
            <svg
              className="glowing-orb__face"
              viewBox="0 0 100 100"
              aria-hidden
              focusable="false"
            >
              <defs>
                <radialGradient id={`${uid}-eye`} cx="45%" cy="40%" r="55%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="25%" stopColor="#ffffff" />
                  <stop offset="55%" stopColor="#e0f7fa" />
                  <stop offset="100%" stopColor="#67e8f9" />
                </radialGradient>
                <filter id={`${uid}-eye-glow`} x="-400%" y="-400%" width="900%" height="900%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* Eye outer bloom */}
              <circle cx="38" cy="48" r="7.5" fill="#38bdf8" opacity="0.22" filter={`url(#${uid}-eye-glow)`} />
              <circle cx="62" cy="48" r="7.5" fill="#38bdf8" opacity="0.22" filter={`url(#${uid}-eye-glow)`} />
              {/* Eye cyan halos */}
              <circle cx="38" cy="48" r="4.5" fill="#67e8f9" opacity="0.55" filter={`url(#${uid}-eye-glow)`} />
              <circle cx="62" cy="48" r="4.5" fill="#67e8f9" opacity="0.55" filter={`url(#${uid}-eye-glow)`} />
              {/* Eye cores — white-hot center with bloom */}
              <circle cx="38" cy="48" r="2.8" fill="#ffffff" filter={`url(#${uid}-eye-glow)`} />
              <circle cx="62" cy="48" r="2.8" fill="#ffffff" filter={`url(#${uid}-eye-glow)`} />
              <circle cx="38" cy="48" r="1.6" fill={`url(#${uid}-eye)`} />
              <circle cx="62" cy="48" r="1.6" fill={`url(#${uid}-eye)`} />
              {/* Smile */}
              <path
                d="M 46 54 Q 50 56.5 54 54"
                fill="none"
                stroke="#ffffff"
                strokeWidth="0.7"
                strokeLinecap="round"
                opacity="0.85"
              />
            </svg>
          </div>
        </div>

        <svg
          className="glowing-orb__ring"
          viewBox="0 0 120 28"
          aria-hidden
          focusable="false"
        >
          <defs>
            <filter id={`${uid}-ring-glow`} x="-30%" y="-200%" width="160%" height="500%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id={`${uid}-ring-stroke`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.12" />
              <stop offset="18%" stopColor="#67e8f9" stopOpacity="0.92" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="82%" stopColor="#67e8f9" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.12" />
            </linearGradient>
          </defs>
          <ellipse
            cx="60"
            cy="14"
            rx="40"
            ry="9"
            fill="none"
            stroke={`url(#${uid}-ring-stroke)`}
            strokeWidth="1.35"
            filter={`url(#${uid}-ring-glow)`}
          />
        </svg>
      </div>
    </div>
  )
}
