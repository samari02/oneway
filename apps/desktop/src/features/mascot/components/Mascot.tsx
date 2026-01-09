import './Mascot.css'

export type MascotMood = 'happy' | 'proud' | 'encouraging' | 'sleepy' | 'thinking'

interface MascotProps {
  mood?: MascotMood
  message?: string
  size?: 'small' | 'medium' | 'large'
  showMessage?: boolean
}

const FACES: Record<MascotMood, string> = {
  happy: '◕‿◕',
  proud: '◕ᴗ◕',
  encouraging: '◕◡◕',
  sleepy: '◡‿◡',
  thinking: '◕_◕',
}

export function Mascot({ 
  mood = 'happy', 
  message, 
  size = 'medium',
  showMessage = true 
}: MascotProps) {
  return (
    <div className={`mascot mascot--${size}`}>
      {message && showMessage && (
        <div className="mascot__bubble">
          <p className="mascot__message">{message}</p>
        </div>
      )}
      <div className={`mascot__blob mascot__blob--${mood}`}>
        <span className="mascot__face">{FACES[mood]}</span>
      </div>
    </div>
  )
}
