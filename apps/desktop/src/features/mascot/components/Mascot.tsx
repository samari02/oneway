import './Mascot.css'

export type MascotMood = 'happy' | 'proud' | 'encouraging' | 'sleepy' | 'thinking'

interface MascotProps {
  mood?: MascotMood
  message?: string
  size?: 'small' | 'medium' | 'large'
  showMessage?: boolean
  onMessageClick?: () => void
}

export function Mascot({ 
  mood = 'happy', 
  message, 
  size = 'medium',
  showMessage = true,
  onMessageClick 
}: MascotProps) {
  // Eye style based on mood
  const getEyeClass = () => {
    switch (mood) {
      case 'happy':
      case 'proud':
        return 'mascot__eye--happy' // Curved happy eyes ᵕᵕ
      case 'sleepy':
        return 'mascot__eye--sleepy' // Closed —
      default:
        return '' // Normal dots ● ●
    }
  }

  return (
    <div className={`mascot mascot--${size}`}>
      {message && showMessage && (
        <div 
          className={`mascot__bubble ${onMessageClick ? 'mascot__bubble--clickable' : ''}`}
          onClick={onMessageClick}
          role={onMessageClick ? 'button' : undefined}
          tabIndex={onMessageClick ? 0 : undefined}
        >
          <p className="mascot__message">{message}</p>
          {onMessageClick && <span className="mascot__bubble-hint">✨</span>}
        </div>
      )}
      <div className={`mascot__blob mascot__blob--${mood}`}>
        {/* Kawaii face */}
        <div className="mascot__face">
          {/* Cheeks (blush) */}
          <div className="mascot__cheek mascot__cheek--left" />
          <div className="mascot__cheek mascot__cheek--right" />
          
          {/* Eyes */}
          <div className={`mascot__eye mascot__eye--left ${getEyeClass()}`} />
          <div className={`mascot__eye mascot__eye--right ${getEyeClass()}`} />
        </div>
        
        {/* Small legs */}
        <div className="mascot__legs">
          <div className="mascot__leg mascot__leg--left" />
          <div className="mascot__leg mascot__leg--right" />
        </div>
      </div>
    </div>
  )
}
