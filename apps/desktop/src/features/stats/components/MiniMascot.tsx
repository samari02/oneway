import './MiniMascot.css'

export type MiniMascotMood = 'happy' | 'focused' | 'meh' | 'worried'

interface MiniMascotProps {
  mood?: MiniMascotMood
  size?: number
}

export function MiniMascot({ mood = 'happy', size = 32 }: MiniMascotProps) {
  const getEyeClass = () => {
    switch (mood) {
      case 'happy':
        return 'mini-mascot__eye--happy'
      case 'focused':
        return 'mini-mascot__eye--focused'
      case 'meh':
        return 'mini-mascot__eye--meh'
      case 'worried':
        return 'mini-mascot__eye--worried'
      default:
        return ''
    }
  }

  return (
    <div 
      className={`mini-mascot mini-mascot--${mood}`}
      style={{ width: size, height: size }}
    >
      {/* Blob body */}
      <div className="mini-mascot__blob">
        {/* Sprout */}
        <div className="mini-mascot__sprout">
          <div className="mini-mascot__sprout-stem" />
          <div className="mini-mascot__sprout-leaf mini-mascot__sprout-leaf--left" />
          <div className="mini-mascot__sprout-leaf mini-mascot__sprout-leaf--right" />
        </div>
        
        {/* Face */}
        <div className="mini-mascot__face">
          <div className="mini-mascot__cheek mini-mascot__cheek--left" />
          <div className="mini-mascot__cheek mini-mascot__cheek--right" />
          <div className={`mini-mascot__eye mini-mascot__eye--left ${getEyeClass()}`} />
          <div className={`mini-mascot__eye mini-mascot__eye--right ${getEyeClass()}`} />
          {mood === 'meh' && <div className="mini-mascot__mouth mini-mascot__mouth--meh" />}
          {mood === 'worried' && <div className="mini-mascot__mouth mini-mascot__mouth--worried" />}
        </div>
      </div>
    </div>
  )
}
