import { useCallback, useEffect, useRef, useState } from 'react'
import type { AmbientTrack } from '../hooks/useAmbientMusicPlayer'
import './AmbientMusicPlayer.css'

type AmbientMusicPlayerProps = {
  tracks: AmbientTrack[]
  currentTrack: AmbientTrack
  isPlaying: boolean
  onToggle: () => void
  onSelectTrack: (trackId: string) => void
  onAddTrack: (file: File) => void
  onRemoveTrack: (trackId: string) => void
  className?: string
}

export function AmbientMusicPlayer({
  tracks,
  currentTrack,
  isPlaying,
  onToggle,
  onSelectTrack,
  onAddTrack,
  onRemoveTrack,
  className = '',
}: AmbientMusicPlayerProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      onAddTrack(file)
      setMenuOpen(false)
    },
    [onAddTrack],
  )

  return (
    <div className={`ambient-player ${className}`.trim()} aria-label="Ambient music player">
      <button
        type="button"
        className="ambient-player__play"
        onClick={onToggle}
        aria-label={isPlaying ? 'Pause ambient music' : 'Play ambient music'}
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
      </button>

      <div className="ambient-player__meta">
        <span className="ambient-player__label">Focus sounds</span>
        <span className="ambient-player__track" title={currentTrack.name}>
          {currentTrack.name}
        </span>
      </div>

      <div className="ambient-player__actions">
        <button
          type="button"
          className="ambient-player__icon-btn"
          aria-label="Add audio file"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        <div className="ambient-player__menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="ambient-player__icon-btn"
            aria-label="Choose track"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {menuOpen && (
            <div className="ambient-player__menu" role="menu">
              {tracks.map((track) => {
                const isActive = track.id === currentTrack.id
                return (
                  <div
                    key={track.id}
                    className={`ambient-player__menu-item${isActive ? ' ambient-player__menu-item--active' : ''}`}
                  >
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      className="ambient-player__menu-select"
                      onClick={() => {
                        onSelectTrack(track.id)
                        setMenuOpen(false)
                      }}
                    >
                      <span>{track.name}</span>
                    </button>
                    {!track.builtin && (
                      <button
                        type="button"
                        className="ambient-player__menu-remove"
                        aria-label={`Remove ${track.name}`}
                        onClick={() => onRemoveTrack(track.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        className="ambient-player__file-input"
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac"
        onChange={handleFileChange}
      />
    </div>
  )
}
