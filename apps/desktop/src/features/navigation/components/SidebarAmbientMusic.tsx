import { useCallback, useEffect, useRef, useState } from 'react'
import { useAmbientMusicPlayer } from '@/features/clarity-home/hooks/useAmbientMusicPlayer'
import './SidebarAmbientMusic.css'

export function SidebarAmbientMusic() {
  const {
    tracks,
    currentTrack,
    isPlaying,
    selectTrack,
    toggle,
  } = useAmbientMusicPlayer({ enabled: false })

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen])

  const handleSelectTrack = useCallback(
    (trackId: string) => {
      selectTrack(trackId)
      setMenuOpen(false)
    },
    [selectTrack],
  )

  return (
    <div className="sidebar-music" aria-label="Ambient music controls">
      <button
        type="button"
        className={`sidebar-music__play${isPlaying ? ' sidebar-music__play--active' : ''}`}
        onClick={toggle}
        title={isPlaying ? 'Pause focus sounds' : 'Play focus sounds'}
        aria-label={isPlaying ? 'Pause focus sounds' : 'Play focus sounds'}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5.14v13.72c0 .79.87 1.27 1.54.84l10.68-6.86c.6-.39.6-1.29 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z" />
          </svg>
        )}
        <span className="sidebar__label">{isPlaying ? 'Pause' : 'Play'}</span>
      </button>

      <div className="sidebar-music__track-wrap" ref={menuRef}>
        <button
          type="button"
          className="sidebar-music__track-btn"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          title={currentTrack.name}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span className="sidebar__label sidebar-music__track-name">{currentTrack.name}</span>
          <svg className="sidebar-music__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {menuOpen && (
          <div className="sidebar-music__menu" role="menu">
            {tracks.map((track) => {
              const isActive = track.id === currentTrack.id
              return (
                <button
                  key={track.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={`sidebar-music__menu-item${isActive ? ' sidebar-music__menu-item--active' : ''}`}
                  onClick={() => handleSelectTrack(track.id)}
                >
                  {track.name}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
