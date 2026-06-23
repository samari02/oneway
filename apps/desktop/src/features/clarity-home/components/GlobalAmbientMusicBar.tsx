import { AmbientMusicPlayer } from './AmbientMusicPlayer'
import { useAmbientMusicPlayer } from '../hooks/useAmbientMusicPlayer'
import './GlobalAmbientMusicBar.css'

type GlobalAmbientMusicBarProps = {
  /** When false, keeps audio synced but hides the global UI (e.g. morning flow has its own player). */
  showPlayer?: boolean
}

export function GlobalAmbientMusicBar({ showPlayer = true }: GlobalAmbientMusicBarProps) {
  const {
    tracks,
    currentTrack,
    isPlaying,
    selectTrack,
    addTrack,
    removeTrack,
    toggle,
  } = useAmbientMusicPlayer({ enabled: false })

  // Hook stays mounted for audio sync even when the morning flow renders its own player.
  if (!showPlayer) return null

  return (
    <div className="global-ambient-music" aria-label="Global ambient music controls">
      <AmbientMusicPlayer
        tracks={tracks}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onToggle={toggle}
        onSelectTrack={selectTrack}
        onAddTrack={addTrack}
        onRemoveTrack={removeTrack}
      />
    </div>
  )
}
