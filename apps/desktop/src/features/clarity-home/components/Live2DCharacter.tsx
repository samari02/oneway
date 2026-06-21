import { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display'
import type { HeroAvatarOption } from '../companion-avatars'

if (typeof window !== 'undefined') {
  window.PIXI = PIXI
}

const LIVE2D_MODELS: Record<'asuka' | 'jian', string> = {
  asuka: '/v2/asuka/Asuka.model3.json',
  jian: '/v2/jian/简.model3.json',
}

let cubismLoadPromise: Promise<void> | null = null

function loadCubismCore(): Promise<void> {
  if (window.Live2DCubismCore) return Promise.resolve()
  if (cubismLoadPromise) return cubismLoadPromise

  cubismLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/v2/1113_v2/live2dcubismcore.min.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Live2D Cubism Core'))
    document.head.appendChild(script)
  })

  return cubismLoadPromise
}

type Live2DCharacterProps = {
  avatar: HeroAvatarOption
  className?: string
}

export function Live2DCharacter({ avatar, className }: Live2DCharacterProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || avatar.kind !== 'live2d' || !avatar.live2dId) return

    let app: PIXI.Application | null = null
    let model: Live2DModel | null = null
    let cancelled = false

    const init = async () => {
      try {
        setError(null)
        await loadCubismCore()
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

        container.innerHTML = ''
        container.appendChild(app.view as HTMLCanvasElement)

        model = await Live2DModel.from(modelUrl)
        if (cancelled) {
          app.destroy(true)
          return
        }

        const scale = Math.min(
          (app.screen.width * 0.9) / model.width,
          (app.screen.height * 0.95) / model.height,
        )
        model.scale.set(scale)
        model.anchor.set(0.5, 0.5)
        model.x = app.screen.width / 2
        model.y = app.screen.height * 0.55

        app.stage.addChild(model)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Live2D unavailable')
        }
      }
    }

    init()

    return () => {
      cancelled = true
      if (model) {
        model.destroy()
      }
      if (app) {
        app.destroy(true, { children: true })
      }
      if (container) {
        container.innerHTML = ''
      }
    }
  }, [avatar.id, avatar.kind, avatar.live2dId])

  if (error) {
    return (
      <div className={`ch-live2d ch-live2d--error ${className ?? ''}`}>
        <span className="ch-live2d__fallback" aria-hidden>
          ✨
        </span>
        <span className="ch-live2d__error-text">{avatar.label}</span>
      </div>
    )
  }

  return <div ref={containerRef} className={`ch-live2d ${className ?? ''}`} aria-hidden />
}
