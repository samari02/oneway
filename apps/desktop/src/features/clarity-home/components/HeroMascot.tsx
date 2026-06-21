import { Component, lazy, Suspense, type ReactNode } from 'react'
import { Mascot } from '@/features/mascot'
import type { HeroAvatarOption } from '../companion-avatars'
import { HeroCharacterSwitcher } from './HeroCharacterSwitcher'
import { Live2DFallback } from './Live2DFallback'

const Live2DCharacter = lazy(() =>
  import('./Live2DCharacter')
    .then((m) => ({ default: m.Live2DCharacter }))
    .catch((err) => {
      console.error('[Live2D] Failed to load character module', err)
      return { default: Live2DFallback }
    }),
)

type Live2DErrorBoundaryProps = {
  avatar: HeroAvatarOption
  className?: string
  children: ReactNode
}

type Live2DErrorBoundaryState = { hasError: boolean }

class Live2DErrorBoundary extends Component<Live2DErrorBoundaryProps, Live2DErrorBoundaryState> {
  state: Live2DErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[Live2D] Render error', error)
  }

  componentDidUpdate(prevProps: Live2DErrorBoundaryProps) {
    if (prevProps.avatar.id !== this.props.avatar.id && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return <Live2DFallback className={this.props.className} />
    }
    return this.props.children
  }
}

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
          {avatar.kind === 'live2d' && (
            <Live2DErrorBoundary avatar={avatar} className="ch-hero-mascot__live2d">
              <Suspense fallback={<span className="ch-live2d__fallback" aria-hidden>✨</span>}>
                <Live2DCharacter avatar={avatar} className="ch-hero-mascot__live2d" />
              </Suspense>
            </Live2DErrorBoundary>
          )}
        </div>
      </div>
      <HeroCharacterSwitcher current={avatar} onCycle={onCycleAvatar} />
    </div>
  )
}
