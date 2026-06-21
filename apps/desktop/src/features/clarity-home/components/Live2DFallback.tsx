import { Mascot } from '@/features/mascot'

type Live2DFallbackProps = {
  className?: string
}

/** Shown when Live2D chunk or runtime init fails. */
export function Live2DFallback({ className }: Live2DFallbackProps) {
  return (
    <div className={`ch-live2d ch-live2d--error ${className ?? ''}`}>
      <Mascot mood="happy" size="large" showMessage={false} />
    </div>
  )
}
