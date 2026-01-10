import { useState, useEffect } from 'react'
import './TimePicker.css'

interface TimePickerProps {
  value: string // "HH:MM"
  onChange: (time: string) => void
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  // Parse initial value
  const parseTime = (time: string) => {
    if (!time) return { hours: 7, minutes: 0 }
    const [h, m] = time.split(':').map(Number)
    return { hours: h || 0, minutes: m || 0 }
  }

  const [time, setTime] = useState(parseTime(value))
  const totalMinutes = time.hours * 60 + time.minutes

  // Update parent when time changes
  useEffect(() => {
    const h = String(time.hours).padStart(2, '0')
    const m = String(time.minutes).padStart(2, '0')
    onChange(`${h}:${m}`)
  }, [time, onChange])

  // Sync with external value changes
  useEffect(() => {
    const parsed = parseTime(value)
    if (parsed.hours !== time.hours || parsed.minutes !== time.minutes) {
      setTime(parsed)
    }
  }, [value])

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const total = parseInt(e.target.value)
    const hours = Math.floor(total / 60)
    const minutes = Math.round((total % 60) / 5) * 5 // Snap to 5-min intervals
    setTime({ hours, minutes: minutes === 60 ? 0 : minutes })
  }

  const handleMinuteAdjust = (delta: number) => {
    let newMinutes = time.minutes + delta
    let newHours = time.hours

    if (newMinutes >= 60) {
      newMinutes = 0
      newHours = (newHours + 1) % 24
    } else if (newMinutes < 0) {
      newMinutes = 55
      newHours = (newHours - 1 + 24) % 24
    }

    setTime({ hours: newHours, minutes: newMinutes })
  }

  // Determine if it's day or night (6am-6pm = day)
  const isDay = time.hours >= 6 && time.hours < 18
  const isDawn = time.hours >= 5 && time.hours < 8
  const isDusk = time.hours >= 17 && time.hours < 20

  // Calculate sun/moon position (0-100%)
  const celestialPosition = (totalMinutes / (24 * 60)) * 100

  // Format display time
  const displayTime = `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`

  return (
    <div className="time-picker">
      <div className="time-picker__display">
        <span className={`time-picker__icon ${isDay ? 'time-picker__icon--day' : 'time-picker__icon--night'}`}>
          {isDay ? '☀️' : '🌙'}
        </span>
        <span className="time-picker__time">{displayTime}</span>
        <div className="time-picker__minutes-adjust">
          <button type="button" onClick={() => handleMinuteAdjust(-5)}>−</button>
          <button type="button" onClick={() => handleMinuteAdjust(5)}>+</button>
        </div>
      </div>

      <div className={`time-picker__slider-container ${isDay ? 'time-picker__slider-container--day' : 'time-picker__slider-container--night'} ${isDawn ? 'time-picker__slider-container--dawn' : ''} ${isDusk ? 'time-picker__slider-container--dusk' : ''}`}>
        <div className="time-picker__track">
          <div 
            className="time-picker__celestial"
            style={{ left: `${celestialPosition}%` }}
          >
            {isDay ? '☀️' : '🌙'}
          </div>
        </div>
        <input
          type="range"
          min="0"
          max={24 * 60 - 1}
          value={totalMinutes}
          onChange={handleSliderChange}
          className="time-picker__slider"
        />
        <div className="time-picker__labels">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </div>
      </div>
    </div>
  )
}
