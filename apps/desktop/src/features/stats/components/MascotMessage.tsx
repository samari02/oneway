import './MascotMessage.css'

interface MascotMessageProps {
  message: string
}

export function MascotMessage({ message }: MascotMessageProps) {
  return (
    <div className="mascot-message">
      <div className="mascot-message__bubble">
        <p className="mascot-message__text">{message}</p>
      </div>
      <div className="mascot-message__mascot">
        <div className="mascot-message__blob">
          <span className="mascot-message__face">◕‿◕</span>
        </div>
      </div>
    </div>
  )
}
