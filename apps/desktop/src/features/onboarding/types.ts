export interface OnboardingData {
  // Step 1: Name + Problems
  displayName: string
  problems: string[]
  
  // Step 2: Best Self
  wakeTime: string      // e.g., "05:30"
  sleepTime: string     // e.g., "21:30"
  screenOffTime: string // e.g., "20:30"
  
  // Step 3: Strictness
  strictness: 'gentle' | 'guided' | 'strict'
}

export const PROBLEMS = [
  { id: 'late_sleep', label: 'Je me couche trop tard', icon: '🌙' },
  { id: 'scrolling', label: 'Je scroll au lieu de bosser', icon: '📱' },
  { id: 'no_routine', label: "Je n'arrive pas à tenir une routine", icon: '🔄' },
  { id: 'low_energy', label: "Je manque d'énergie le matin", icon: '😴' },
  { id: 'distractions', label: 'Je me laisse distraire facilement', icon: '🎯' },
] as const

export const STRICTNESS_OPTIONS = [
  {
    id: 'gentle' as const,
    label: 'Gentle',
    description: 'Je track, je te rappelle, mais je bloque rien',
    emoji: '🟢',
  },
  {
    id: 'guided' as const,
    label: 'Guided',
    description: 'Je bloque les distractions, bypass possible',
    emoji: '🟡',
  },
  {
    id: 'strict' as const,
    label: 'Strict',
    description: "Pas d'accès tant que la routine n'est pas faite",
    emoji: '🔴',
  },
] as const

export const DEFAULT_HABITS = [
  { name: 'Morning light', icon: '☀️', forProblems: ['low_energy', 'late_sleep'] },
  { name: 'Drink water', icon: '💧', forProblems: ['low_energy'] },
  { name: 'Exercise', icon: '🏃', forProblems: ['low_energy', 'no_routine'] },
  { name: 'Meditate', icon: '🧘', forProblems: ['distractions', 'no_routine'] },
  { name: 'No phone first hour', icon: '📵', forProblems: ['scrolling', 'distractions'] },
] as const
