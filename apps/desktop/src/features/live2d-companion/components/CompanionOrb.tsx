import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_COMPANION_AVATAR_ID,
  getCompanionAvatar,
  getNextCompanionAvatarId,
  type CompanionAvatarId,
} from '../companion-avatars'
import { CompanionCharacter } from './CompanionCharacter'
import './CompanionOrb.css'

const STORAGE_KEY = 'clarity-companion-orb-position'
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

  const [avatarId, setAvatarId] = useState<CompanionAvatarId>(DEFAULT_COMPANION_AVATAR_ID)
  const [position, setPosition] = useState<OrbPosition>(() => defaultPosition(220))
  const [dragging, setDragging] = useState(false)

  const avatar = getCompanionAvatar(avatarId)
  const nextAvatar = getCompanionAvatar(getNextCompanionAvatarId(avatarId))

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
    if ((event.target as HTMLElement).closest('.companion-orb__toggle')) return

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
      className={`companion-orb-wrap${dragging ? ' companion-orb-wrap--dragging' : ''}`}
      style={{ left: position.x, top: position.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="companion-orb">
        <CompanionCharacter
          key={avatarId}
          avatarId={avatarId}
          className="companion-orb__canvas"
        />
      </div>
      <button
        type="button"
        className="companion-orb__toggle"
        onClick={() => setAvatarId(getNextCompanionAvatarId(avatarId))}
        aria-label={`Switch avatar to ${nextAvatar.label}`}
        title={`Avatar: ${avatar.label} — click for ${nextAvatar.label}`}
      >
        {avatar.label}
      </button>
    </div>
  )
}
