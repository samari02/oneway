import { GlowingOrbCharacter } from '../GlowingOrbCharacter'
import { useCompanionDesignVariant } from '../../hooks/useCompanionDesignVariant'
import type { ReactNode } from 'react'

type MorningFlowShellProps = {
  firstName: string
  monkMessage: string
  greetingTitle?: string
  greetingSubtitle?: string
  children: ReactNode
  footer?: ReactNode
  isProcessing?: boolean
}

export function MorningFlowShell({
  firstName,
  monkMessage,
  greetingTitle,
  greetingSubtitle,
  children,
  footer,
  isProcessing = false,
}: MorningFlowShellProps) {
  const { variant } = useCompanionDesignVariant()

  return (
    <div className="mf-shell mf-stagger">
      <header className="mf-shell__header">
        <h1 className="mf-shell__title">{greetingTitle ?? `Good morning, ${firstName}.`}</h1>
        <p className="mf-shell__subtitle">{greetingSubtitle ?? `I'm here with you.`}</p>
      </header>

      <div className="mf-shell__hero">
        <div className="mf-shell__hero-atmosphere" aria-hidden />
        <div className="mf-shell__hero-row">
          <GlowingOrbCharacter size={200} variant={variant} className="mf-shell__monk" />
          <div className="mf-shell__bubble" aria-live="polite">
            <p className="mf-shell__bubble-text">{monkMessage}</p>
          </div>
        </div>
      </div>

      <div className={`mf-shell__content${isProcessing ? ' mf-shell__content--busy' : ''}`}>
        {children}
      </div>

      {footer && <footer className="mf-shell__footer">{footer}</footer>}
    </div>
  )
}
