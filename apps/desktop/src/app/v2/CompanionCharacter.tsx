import { useEffect, useRef } from 'react'
import type { Application } from 'pixi.js'
import type { Live2DModel } from 'pixi-live2d-display/cubism4'

const MODEL_PATH = '/v2/1113_v2/Z.model3.json'
const CORE_PATH = '/v2/1113_v2/live2dcubismcore.min.js'
const AVATAR_SRC = '/v2/face_base.png'

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

const ORB_REF_SIZE = 140
const FACE_ZOOM = 1.6
const FACE_Y = 0.65

function layoutModel(
  model: Live2DModel,
  viewWidth: number,
  viewHeight: number,
) {
  if (viewWidth <= 0 || viewHeight <= 0) return

  model.anchor.set(0.5, 0.5)

  const im = model.internalModel
  const modelW = im?.width ?? model.width
  const modelH = im?.height ?? model.height
  if (modelW <= 0 || modelH <= 0) return

  // Fixed scale — independent of orb size; only position follows the container.
  const scale =
    Math.min(ORB_REF_SIZE / modelW, ORB_REF_SIZE / modelH) * FACE_ZOOM

  model.scale.set(scale)
  model.position.set(viewWidth / 2, viewHeight * FACE_Y)
}

export function CompanionCharacter({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const modelRef = useRef<Live2DModel | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let destroyed = false
    let resizeObserver: ResizeObserver | undefined
    let onPointerMove: ((event: PointerEvent) => void) | undefined
    let fitFrame = 0

    const host = container

    async function init() {
      await loadScript(CORE_PATH)
      if (destroyed) return

      const PIXI = await import('pixi.js')
      // pixi-live2d-display reads window.PIXI.Ticker for auto-updates
      ;(window as Window & { PIXI?: typeof PIXI }).PIXI = PIXI

      const { Live2DModel } = await import('pixi-live2d-display/cubism4')
      if (destroyed) return

      const app = new PIXI.Application({
        backgroundAlpha: 0,
        antialias: true,
        resizeTo: host,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      appRef.current = app
      host.appendChild(app.view as HTMLCanvasElement)

      const model = await Live2DModel.from(MODEL_PATH)
      if (destroyed) {
        model.destroy()
        app.destroy(true, { children: true })
        return
      }

      modelRef.current = model
      app.stage.addChild(model)

      const fit = () => {
        cancelAnimationFrame(fitFrame)
        fitFrame = requestAnimationFrame(() => {
          if (!modelRef.current || destroyed) return
          layoutModel(modelRef.current, host.clientWidth, host.clientHeight)
        })
      }

      fit()

      resizeObserver = new ResizeObserver(fit)
      resizeObserver.observe(host)

      onPointerMove = (event: PointerEvent) => {
        if (!modelRef.current) return
        const rect = host.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        modelRef.current.focus(x, y)
      }
      window.addEventListener('pointermove', onPointerMove)
    }

    init().catch((error) => {
      console.error('[CompanionCharacter] Live2D init failed:', error)
    })

    return () => {
      destroyed = true
      cancelAnimationFrame(fitFrame)
      resizeObserver?.disconnect()
      if (onPointerMove) window.removeEventListener('pointermove', onPointerMove)
      modelRef.current?.destroy()
      modelRef.current = null
      appRef.current?.destroy(true, { children: true })
      appRef.current = null
      host.replaceChildren()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`v2-companion${className ? ` ${className}` : ''}`}
      aria-hidden
    />
  )
}

export const COMPANION_AVATAR_SRC = AVATAR_SRC
