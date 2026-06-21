import './Mascot.css'

export type MascotMood = 'happy' | 'proud' | 'encouraging' | 'sleepy' | 'thinking'

interface MascotProps {
  mood?: MascotMood
  message?: string
  size?: 'small' | 'medium' | 'large'
  showMessage?: boolean
  onChatClick?: () => void
  /** When set, renders this PNG instead of the CSS blob mascot. */
  imageSrc?: string
}

export function Mascot({ 
  mood = 'happy', 
  message, 
  size = 'medium',
  showMessage = true,
  onChatClick,
  imageSrc,
}: MascotProps) {
  const getEyeClass = () => {
    switch (mood) {
      case 'happy':
      case 'proud':
        return 'mascot__eye--happy'
      case 'sleepy':
        return 'mascot__eye--sleepy'
      default:
        return ''
    }
  }

  return (
    <div 
      className={`mascot mascot--${size} ${onChatClick ? 'mascot--interactive' : ''}`}
      onClick={onChatClick}
      role={onChatClick ? 'button' : undefined}
      tabIndex={onChatClick ? 0 : undefined}
    >
      {message && showMessage && (
        <div className="mascot__bubble">
          <p className="mascot__message">{message}</p>
        </div>
      )}
      
      {imageSrc ? (
        <div className="mascot__image-wrap">
          <img
            className="mascot__image"
            src={imageSrc}
            alt=""
            draggable={false}
          />
          {onChatClick && (
            <div className="mascot__chat-hint">Chat with Aoi</div>
          )}
        </div>
      ) : (
        <div className={`mascot__blob mascot__blob--${mood}`}>
          {/* Green sprout on top */}
          <div className="mascot__sprout">
            <div className="mascot__sprout-stem" />
            <div className="mascot__sprout-leaf mascot__sprout-leaf--left" />
            <div className="mascot__sprout-leaf mascot__sprout-leaf--right" />
          </div>
          
          {/* Kawaii face */}
          <div className="mascot__face">
            <div className="mascot__cheek mascot__cheek--left" />
            <div className="mascot__cheek mascot__cheek--right" />
            <div className={`mascot__eye mascot__eye--left ${getEyeClass()}`} />
            <div className={`mascot__eye mascot__eye--right ${getEyeClass()}`} />
            {/* Only show mouth when eyes are round dots (encouraging/thinking) */}
            {mood !== 'happy' && mood !== 'proud' && mood !== 'sleepy' && (
              <div className={`mascot__mouth mascot__mouth--${mood}`} />
            )}
          </div>
          
          {/* Small legs */}
          <div className="mascot__legs">
            <div className="mascot__leg mascot__leg--left" />
            <div className="mascot__leg mascot__leg--right" />
          </div>
          
          {/* Hover hint for chat */}
          {onChatClick && (
            <div className="mascot__chat-hint">Chat with Aoi</div>
          )}
        </div>
      )}
    </div>
  )
}
