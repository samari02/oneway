// API
export { 
  getHabits, 
  createHabit, 
  updateHabit,
  checkHabit, 
  uncheckHabit,
  getHabitStreak,
  type CreateHabitData,
  type UpdateHabitData
} from './api/habits'

// Hooks
export { useHabits } from './hooks/useHabits'
export { useTodayCheckIns } from './hooks/useTodayCheckIns'
export { useHabitActions } from './hooks/useHabitActions'

// Components
export { HabitList } from './components/HabitList'
export { HabitItem } from './components/HabitItem'
export { AddHabitForm } from './components/AddHabitForm'
export { EditHabitModal } from './components/EditHabitModal'
