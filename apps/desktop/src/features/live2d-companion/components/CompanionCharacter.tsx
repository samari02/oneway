import { useEffect, useRef } from 'react'
import type { Application } from 'pixi.js'
import type { Live2DModel } from 'pixi-live2d-display/cubism4'
import {
  COMPANION_CORE_PATH,
  DEFAULT_COMPANION_AVATAR_ID,
  getCompanionAvatar,
  type CompanionAvatarId,
  type CompanionAvatarLayout,
} from '../companion-avatars'

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

function layoutModel(
  model: Live2DModel,
  viewWidth: number,
  viewHeight: number,
  layout: CompanionAvatarLayout,
) {
  if (viewWidth <= 0 || viewHeight <= 0) return

  const im = model.internalModel
  const modelW = im?.width ?? model.width
  const modelH = im?.height ?? model.height
  if (modelW <= 0 || modelH <= 0) return

  const scale =
    Math.min(layout.refSize / modelW, layout.refSize / modelH) * layout.zoom

  model.anchor.set(layout.anchorX, layout.anchorY)
  model.scale.set(scale)
  model.position.set(viewWidth * layout.faceX, viewHeight * layout.faceY)
}

type CompanionCharacterProps = {
  className?: string
  avatarId?: CompanionAvatarId
}

export function CompanionCharacter({
  className,
  avatarId = DEFAULT_COMPANION_AVATAR_ID,
}: CompanionCharacterProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const modelRef = useRef<Live2DModel | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const avatar = getCompanionAvatar(avatarId)
    let destroyed = false
    let resizeObserver: ResizeObserver | undefined
    let onPointerMove: ((event: PointerEvent) => void) | undefined
    let fitFrame = 0

    const host = container

    async function init() {
      await loadScript(COMPANION_CORE_PATH)
      if (destroyed) return

      const PIXI = await import('pixi.js')
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

      const model = await Live2DModel.from(avatar.modelPath)
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
          layoutModel(
            modelRef.current,
            host.clientWidth,
            host.clientHeight,
            avatar.layout,
          )
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
  }, [avatarId])

  return (
    <div
      ref={containerRef}
      className={`companion-canvas${className ? ` ${className}` : ''}`}
      aria-hidden
    />
  )
}
