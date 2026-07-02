import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './TasksContextMenu.css'

export type ContextMenuItem = {
  id: string
  label: string
  onSelect: () => void
  danger?: boolean
}

export type ContextMenuState = {
  x: number
  y: number
  items: ContextMenuItem[]
} | null

export function useTasksContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>(null)

  const openMenu = useCallback((event: React.MouseEvent, items: ContextMenuItem[]) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, items })
  }, [])

  const closeMenu = useCallback(() => setMenu(null), [])

  return { menu, openMenu, closeMenu }
}

export function TasksContextMenu({
  menu,
  onClose,
}: {
  menu: ContextMenuState
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) {
      setPosition(null)
      return
    }
    const rect = menuRef.current.getBoundingClientRect()
    let x = menu.x
    let y = menu.y
    const pad = 8
    if (x + rect.width > window.innerWidth - pad) {
      x = Math.max(pad, window.innerWidth - rect.width - pad)
    }
    if (y + rect.height > window.innerHeight - pad) {
      y = Math.max(pad, window.innerHeight - rect.height - pad)
    }
    setPosition({ x, y })
  }, [menu])

  useEffect(() => {
    if (!menu) return

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    const handleScroll = () => onClose()

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [menu, onClose])

  if (!menu) return null

  const style = position ?? { x: menu.x, y: menu.y }

  return createPortal(
    <div
      ref={menuRef}
      className="tasks-context-menu"
      role="menu"
      style={{ left: style.x, top: style.y }}
    >
      {menu.items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={`tasks-context-menu__item${item.danger ? ' tasks-context-menu__item--danger' : ''}`}
          onClick={() => {
            item.onSelect()
            onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}
