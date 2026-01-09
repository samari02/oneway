// API
export { 
  getHabits, 
  createHabit, 
  checkHabit, 
  uncheckHabit,
  getHabitStreak,
  type CreateHabitData
} from './api/habits'

// Hooks
export { useHabits } from './hooks/useHabits'
export { useTodayCheckIns } from './hooks/useTodayCheckIns'
export { useHabitActions } from './hooks/useHabitActions'

// Components
export { HabitList } from './components/HabitList'
export { HabitItem } from './components/HabitItem'
export { AddHabitForm } from './components/AddHabitForm'
