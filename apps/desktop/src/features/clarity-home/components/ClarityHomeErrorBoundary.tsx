import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Mascot } from '@/features/mascot'
import { HERO_AVATAR_OPTIONS, HERO_AVATAR_STORAGE_KEY } from '../companion-avatars'

type ClarityHomeErrorBoundaryProps = {
  children: ReactNode
}

type ClarityHomeErrorBoundaryState = {
  hasError: boolean
}

function resetInvalidSavedAvatar() {
  try {
    const saved = localStorage.getItem(HERO_AVATAR_STORAGE_KEY)
    if (saved && !HERO_AVATAR_OPTIONS.some((a) => a.id === saved)) {
      localStorage.setItem(HERO_AVATAR_STORAGE_KEY, 'mascot')
    }
  } catch {
    /* ignore */
  }
}

export class ClarityHomeErrorBoundary extends Component<
  ClarityHomeErrorBoundaryProps,
  ClarityHomeErrorBoundaryState
> {
  state: ClarityHomeErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ClarityHomeErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ClarityHome] Render error:', error, info.componentStack)
    resetInvalidSavedAvatar()
  }

  private handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="clarity-home clarity-home--fallback">
          <div className="clarity-home__shell clarity-home__shell--fallback">
            <div className="ch-home-fallback">
              <Mascot mood="happy" size="large" showMessage={false} />
              <h1 className="ch-home-fallback__title">Home is taking a breather</h1>
              <p className="ch-home-fallback__text">
                The companion avatar failed to load. We switched back to the orb so the rest of
                Clarity keeps working.
              </p>
              <button type="button" className="ch-btn ch-btn--ghost" onClick={this.handleRetry}>
                Try again
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
