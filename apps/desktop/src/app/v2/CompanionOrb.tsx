import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CompanionCharacter,
  getCompanionAvatar,
  getOtherCompanionAvatarId,
  type CompanionAvatarId,
} from './CompanionCharacter'

const STORAGE_KEY = 'v2-companion-orb-position'
const ORB_MARGIN = 28
const VIEWPORT_PAD = 8

type OrbPosition = { x: number; y: number }

function readSavedPosition(): OrbPosition | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OrbPosition
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed
  } catch {
    /* ignore */
  }
  return null
}

function defaultPosition(orbWidth: number): OrbPosition {
  return {
    x: Math.max(VIEWPORT_PAD, window.innerWidth - orbWidth - ORB_MARGIN),
    y: ORB_MARGIN,
  }
}

function clampPosition(
  pos: OrbPosition,
  wrapWidth: number,
  wrapHeight: number,
): OrbPosition {
  const maxX = window.innerWidth - wrapWidth - VIEWPORT_PAD
  const maxY = window.innerHeight - wrapHeight - VIEWPORT_PAD
  return {
    x: Math.max(VIEWPORT_PAD, Math.min(pos.x, maxX)),
    y: Math.max(VIEWPORT_PAD, Math.min(pos.y, maxY)),
  }
}

export function CompanionOrb() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

  const [avatarId, setAvatarId] = useState<CompanionAvatarId>('jian')
  const [position, setPosition] = useState<OrbPosition>(() => defaultPosition(220))
  const [dragging, setDragging] = useState(false)

  const avatar = getCompanionAvatar(avatarId)
  const otherAvatar = getCompanionAvatar(getOtherCompanionAvatarId(avatarId))

  const persistPosition = useCallback((pos: OrbPosition) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos))
  }, [])

  const applyClampedPosition = useCallback((next: OrbPosition) => {
    const wrap = wrapRef.current
    const width = wrap?.offsetWidth ?? 220
    const height = wrap?.offsetHeight ?? 260
    setPosition(clampPosition(next, width, height))
  }, [])

  useEffect(() => {
    const saved = readSavedPosition()
    applyClampedPosition(saved ?? defaultPosition(wrapRef.current?.offsetWidth ?? 220))
  }, [applyClampedPosition])

  useEffect(() => {
    const onResize = () => {
      setPosition((prev) => {
        const wrap = wrapRef.current
        const width = wrap?.offsetWidth ?? 220
        const height = wrap?.offsetHeight ?? 260
        return clampPosition(prev, width, height)
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.v2-companion-orb__toggle')) return

    event.preventDefault()
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origX: position.x,
      origY: position.y,
    }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    applyClampedPosition({
      x: drag.origX + dx,
      y: drag.origY + dy,
    })
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    dragRef.current = null
    setDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
    setPosition((prev) => {
      persistPosition(prev)
      return prev
    })
  }

  return (
    <div
      ref={wrapRef}
      className={`v2-companion-orb-wrap${dragging ? ' v2-companion-orb-wrap--dragging' : ''}`}
      style={{ left: position.x, top: position.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="v2-companion-orb">
        <CompanionCharacter
          key={avatarId}
          avatarId={avatarId}
          className="v2-companion-orb__canvas"
        />
      </div>
      <button
        type="button"
        className="v2-companion-orb__toggle"
        onClick={() => setAvatarId(getOtherCompanionAvatarId(avatarId))}
        aria-label={`Switch avatar to ${otherAvatar.label}`}
        title={`Avatar: ${avatar.label} — click for ${otherAvatar.label}`}
      >
        {avatar.label}
      </button>
    </div>
  )
}
