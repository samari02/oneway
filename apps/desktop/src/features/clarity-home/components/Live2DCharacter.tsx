import { useEffect, useRef, useState } from 'react'
import type { HeroAvatarOption } from '../companion-avatars'
import { Live2DFallback } from './Live2DFallback'

const LIVE2D_MODELS: Record<'asuka' | 'jian', string> = {
  asuka: '/v2/asuka/Asuka.model3.json',
  jian: '/v2/jian/简.model3.json',
}

/** Bust portrait framing — scale up and anchor high so only upper torso shows. */
const BUST_LAYOUT: Record<
  'asuka' | 'jian',
  { scaleMul: number; anchorY: number; yRatio: number }
> = {
  asuka: { scaleMul: 2.2, anchorY: 0.38, yRatio: 0.54 },
  jian: { scaleMul: 2.0, anchorY: 0.36, yRatio: 0.52 },
}

const CUBISM_CORE_URL = '/v2/1113_v2/live2dcubismcore.min.js'

let cubismLoadPromise: Promise<void> | null = null

function loadCubismCore(): Promise<void> {
  if (typeof window !== 'undefined' && window.Live2DCubismCore) {
    return Promise.resolve()
  }
  if (cubismLoadPromise) return cubismLoadPromise

  cubismLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CUBISM_CORE_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Live2D Cubism Core'))
    document.head.appendChild(script)
  })

  return cubismLoadPromise
}

type Live2DRuntime = {
  PIXI: typeof import('pixi.js')
  Live2DModel: typeof import('pixi-live2d-display/cubism4').Live2DModel
}

let live2dRuntimePromise: Promise<Live2DRuntime> | null = null

async function loadLive2DRuntime(): Promise<Live2DRuntime> {
  if (live2dRuntimePromise) return live2dRuntimePromise

  live2dRuntimePromise = (async () => {
    const PIXI = await import('pixi.js')
    if (typeof window !== 'undefined') {
      window.PIXI = PIXI
    }
    const { Live2DModel } = await import('pixi-live2d-display/cubism4')
    return { PIXI, Live2DModel }
  })()

  return live2dRuntimePromise
}

type Live2DCharacterProps = {
  avatar: HeroAvatarOption
  className?: string
}

export function Live2DCharacter({ avatar, className }: Live2DCharacterProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container || avatar.kind !== 'live2d' || !avatar.live2dId) return

    let app: import('pixi.js').Application | null = null
    let model: import('pixi-live2d-display/cubism4').Live2DModel | null = null
    let cancelled = false

    const init = async () => {
      try {
        setFailed(false)
        await loadCubismCore()
        const { PIXI, Live2DModel } = await loadLive2DRuntime()
        if (cancelled) return

        const modelUrl = LIVE2D_MODELS[avatar.live2dId!]
        app = new PIXI.Application({
          width: container.clientWidth || 160,
          height: container.clientHeight || 180,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        })

        container.replaceChildren(app.view as HTMLCanvasElement)

        model = await Live2DModel.from(modelUrl)
        if (cancelled) {
          app.destroy(true)
          return
        }

        const layout = BUST_LAYOUT[avatar.live2dId!]
        const fitScale = Math.min(
          (app.screen.width * 0.9) / model.width,
          (app.screen.height * 0.95) / model.height,
        )
        model.scale.set(fitScale * layout.scaleMul)
        model.anchor.set(0.5, layout.anchorY)
        model.x = app.screen.width / 2
        model.y = app.screen.height * layout.yRatio

        app.stage.addChild(model)
      } catch (err) {
        console.warn('[Live2DCharacter] Failed to initialize:', err)
        if (!cancelled) {
          setFailed(true)
        }
      }
    }

    void init()

    return () => {
      cancelled = true
      model?.destroy()
      app?.destroy(true, { children: true })
      container.replaceChildren()
    }
  }, [avatar.id, avatar.kind, avatar.live2dId])

  if (failed) {
    return <Live2DFallback className={className} />
  }

  return <div ref={containerRef} className={`ch-live2d ${className ?? ''}`} aria-hidden />
}
