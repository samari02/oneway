import type { CSSProperties } from 'react'
import './GlowingOrbCharacter.css'

interface GlowingOrbCharacterProps {
  /** Total visual height in px (sphere + ring + bloom). */
  size?: number
  className?: string
}

export function GlowingOrbCharacter({ size = 160, className }: GlowingOrbCharacterProps) {
  const sphere = Math.round(size * 0.55)
  const ringW = Math.round(size * 0.72)

  return (
    <div
      className={`glowing-orb${className ? ` ${className}` : ''}`}
      style={{ '--orb-size': `${size}px`, '--orb-sphere': `${sphere}px`, '--orb-ring-w': `${ringW}px` } as CSSProperties}
      role="img"
      aria-label="Companion orb"
    >
      <div className="glowing-orb__bloom" aria-hidden />

      <div className="glowing-orb__body">
        <div className="glowing-orb__sphere">
          <div className="glowing-orb__sheen" aria-hidden />
          <div className="glowing-orb__rim" aria-hidden />
          <svg
            className="glowing-orb__face"
            viewBox="0 0 100 100"
            aria-hidden
            focusable="false"
          >
            <defs>
              <radialGradient id="glowing-orb-eye-core" cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="45%" stopColor="#e0f7fa" />
                <stop offset="100%" stopColor="#67e8f9" />
              </radialGradient>
              <filter id="glowing-orb-eye-halo" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur stdDeviation="2.4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <circle cx="28" cy="47" r="3" fill="#38bdf8" opacity="0.32" filter="url(#glowing-orb-eye-halo)" />
            <circle cx="72" cy="47" r="3" fill="#38bdf8" opacity="0.32" filter="url(#glowing-orb-eye-halo)" />
            <circle cx="28" cy="47" r="1.15" fill="url(#glowing-orb-eye-core)" />
            <circle cx="72" cy="47" r="1.15" fill="url(#glowing-orb-eye-core)" />
            <path
              d="M 46.5 53.2 Q 50 54 53.5 53.2"
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.55"
              strokeLinecap="round"
              opacity="0.9"
            />
          </svg>
        </div>

        <svg
          className="glowing-orb__ring"
          viewBox="0 0 120 28"
          aria-hidden
          focusable="false"
        >
          <defs>
            <filter id="glowing-orb-ring-glow" x="-20%" y="-150%" width="140%" height="400%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="glowing-orb-ring-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
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
            rx="52"
            ry="8.5"
            fill="none"
            stroke="url(#glowing-orb-ring-stroke)"
            strokeWidth="1.15"
            filter="url(#glowing-orb-ring-glow)"
          />
        </svg>
      </div>
    </div>
  )
}
