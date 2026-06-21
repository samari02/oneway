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
                <radialGradient id={`${uid}-eye`} cx="40%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="45%" stopColor="#e0f7fa" />
                  <stop offset="100%" stopColor="#67e8f9" />
                </radialGradient>
                <filter id={`${uid}-eye-glow`} x="-200%" y="-200%" width="500%" height="500%">
                  <feGaussianBlur stdDeviation="2.4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* Eye glow halos */}
              <circle cx="38" cy="48" r="3.2" fill="#38bdf8" opacity="0.35" filter={`url(#${uid}-eye-glow)`} />
              <circle cx="62" cy="48" r="3.2" fill="#38bdf8" opacity="0.35" filter={`url(#${uid}-eye-glow)`} />
              {/* Eye cores */}
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
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id={`${uid}-ring-stroke`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.08" />
              <stop offset="18%" stopColor="#67e8f9" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#e0f2fe" stopOpacity="1" />
              <stop offset="82%" stopColor="#67e8f9" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.08" />
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
