import { useState, useRef, useEffect } from 'react'
import EmojiPickerReact, { EmojiClickData, Theme } from 'emoji-picker-react'
import './EmojiPicker.css'

interface EmojiPickerProps {
  value: string
  onChange: (emoji: string) => void
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleSelect = (emojiData: EmojiClickData) => {
    onChange(emojiData.emoji)
    setIsOpen(false)
  }

  return (
    <div className="emoji-picker" ref={containerRef}>
      <button
        type="button"
        className="emoji-picker__trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="emoji-picker__value">{value || '✨'}</span>
        <span className="emoji-picker__label">Change</span>
      </button>

      {isOpen && (
        <div className="emoji-picker__popup">
          <EmojiPickerReact
            onEmojiClick={handleSelect}
            theme={Theme.LIGHT}
            searchPlaceHolder="Search emoji..."
            width={280}
            height={320}
            previewConfig={{ showPreview: false }}
            skinTonesDisabled
            lazyLoadEmojis
          />
        </div>
      )}
    </div>
  )
}
