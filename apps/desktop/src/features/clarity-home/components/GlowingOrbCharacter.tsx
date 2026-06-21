import { useId, type CSSProperties } from 'react'
import './GlowingOrbCharacter.css'

interface GlowingOrbCharacterProps {
  /** Total visual height in px (sphere + ring + bloom). */
  size?: number
  className?: string
}

export function GlowingOrbCharacter({ size = 160, className }: GlowingOrbCharacterProps) {
  const uid = useId().replace(/:/g, '')
  const sphere = Math.round(size * 0.62)
  const ringW = Math.round(sphere * 0.7)

  return (
    <div
      className={`glowing-orb${className ? ` ${className}` : ''}`}
      style={{ '--orb-size': `${size}px`, '--orb-sphere': `${sphere}px`, '--orb-ring-w': `${ringW}px` } as CSSProperties}
      role="img"
      aria-label="Companion orb"
    >
      <div className="glowing-orb__stars" aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
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
                <radialGradient id={`${uid}-eye-bloom`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="22%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="34%" stopColor="#93c5fd" stopOpacity="0.72" />
                  <stop offset="64%" stopColor="#38bdf8" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                </radialGradient>
              </defs>
              <g className="glowing-orb__eyes">
                <circle cx="35" cy="48" r="6.8" fill={`url(#${uid}-eye-bloom)`} />
                <circle cx="65" cy="48" r="6.8" fill={`url(#${uid}-eye-bloom)`} />
                <circle cx="35" cy="48" r="2.25" fill="#ffffff" />
                <circle cx="65" cy="48" r="2.25" fill="#ffffff" />
              </g>
              {/* Smile */}
              <path
                className="glowing-orb__mouth"
                d="M 46 54 Q 50 56.5 54 54"
                fill="none"
                stroke="#67e8f9"
                strokeWidth="0.85"
                strokeLinecap="round"
                opacity="0.72"
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
            <linearGradient id={`${uid}-ring-stroke`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.02" />
              <stop offset="12%" stopColor="#0891b2" stopOpacity="0.36" />
              <stop offset="27%" stopColor="#22d3ee" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#a5f3fc" stopOpacity="0.98" />
              <stop offset="73%" stopColor="#22d3ee" stopOpacity="0.9" />
              <stop offset="88%" stopColor="#0891b2" stopOpacity="0.36" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id={`${uid}-ring-bloom`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0" />
              <stop offset="24%" stopColor="#22d3ee" stopOpacity="0.22" />
              <stop offset="50%" stopColor="#67e8f9" stopOpacity="0.34" />
              <stop offset="76%" stopColor="#22d3ee" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>
          </defs>
          <ellipse
            cx="60"
            cy="14"
            rx="48"
            ry="9.2"
            fill="none"
            stroke={`url(#${uid}-ring-bloom)`}
            strokeWidth="3.8"
          />
          <ellipse
            cx="60"
            cy="14"
            rx="46"
            ry="8.2"
            fill="none"
            stroke={`url(#${uid}-ring-stroke)`}
            strokeWidth="1.9"
          />
        </svg>
      </div>
    </div>
  )
}
