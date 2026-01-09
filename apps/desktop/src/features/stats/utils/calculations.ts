import type { Habit, HabitCheckIn } from '@oneway/shared'

/**
 * Get date string in YYYY-MM-DD format
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Get array of dates from startDate to endDate
 */
export function getDateRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = []
  const current = new Date(startDate)
  
  while (current <= endDate) {
    dates.push(formatDate(current))
    current.setDate(current.getDate() + 1)
  }
  
  return dates
}

/**
 * Calculate current streak based on required habits
 * A day counts if ALL required habits are completed
 */
export function calculateCurrentStreak(
  checkIns: HabitCheckIn[],
  habits: Habit[]
): number {
  const requiredHabits = habits.filter(h => h.is_required)
  
  // If no required habits, streak is 0
  if (requiredHabits.length === 0) return 0
  
  const requiredIds = new Set(requiredHabits.map(h => h.id))
  
  // Group check-ins by date
  const checkInsByDate = new Map<string, Set<string>>()
  for (const checkIn of checkIns) {
    if (!checkInsByDate.has(checkIn.date)) {
      checkInsByDate.set(checkIn.date, new Set())
    }
    checkInsByDate.get(checkIn.date)!.add(checkIn.habit_id)
  }
  
  // Check consecutive days starting from today
  let streak = 0
  const today = new Date()
  const current = new Date(today)
  
  while (true) {
    const dateStr = formatDate(current)
    const completedToday = checkInsByDate.get(dateStr) || new Set()
    
    // Check if all required habits are done for this day
    const allRequiredDone = [...requiredIds].every(id => completedToday.has(id))
    
    if (allRequiredDone) {
      streak++
      current.setDate(current.getDate() - 1)
    } else {
      // If today is not complete, check if we're still within today
      // (give benefit of the doubt for today)
      if (dateStr === formatDate(today)) {
        current.setDate(current.getDate() - 1)
        continue
      }
      break
    }
  }
  
  return streak
}

/**
 * Calculate best (longest) streak ever
 */
export function calculateBestStreak(
  checkIns: HabitCheckIn[],
  habits: Habit[]
): number {
  const requiredHabits = habits.filter(h => h.is_required)
  
  if (requiredHabits.length === 0) return 0
  
  const requiredIds = new Set(requiredHabits.map(h => h.id))
  
  // Group check-ins by date
  const checkInsByDate = new Map<string, Set<string>>()
  for (const checkIn of checkIns) {
    if (!checkInsByDate.has(checkIn.date)) {
      checkInsByDate.set(checkIn.date, new Set())
    }
    checkInsByDate.get(checkIn.date)!.add(checkIn.habit_id)
  }
  
  // Get all dates with activity, sorted
  const dates = [...checkInsByDate.keys()].sort()
  
  if (dates.length === 0) return 0
  
  let bestStreak = 0
  let currentStreak = 0
  let prevDate: Date | null = null
  
  for (const dateStr of dates) {
    const completedToday = checkInsByDate.get(dateStr)!
    const allRequiredDone = [...requiredIds].every(id => completedToday.has(id))
    
    if (allRequiredDone) {
      const currentDate = new Date(dateStr)
      
      if (prevDate) {
        const daysDiff = Math.round(
          (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        )
        
        if (daysDiff === 1) {
          currentStreak++
        } else {
          currentStreak = 1
        }
      } else {
        currentStreak = 1
      }
      
      bestStreak = Math.max(bestStreak, currentStreak)
      prevDate = currentDate
    }
  }
  
  return bestStreak
}

/**
 * Calculate completion rate for a period
 */
export function calculateCompletionRate(
  checkIns: HabitCheckIn[],
  habits: Habit[],
  days: number
): { rate: number; completed: number; total: number } {
  const requiredHabits = habits.filter(h => h.is_required)
  
  if (requiredHabits.length === 0) {
    return { rate: 0, completed: 0, total: days }
  }
  
  const requiredIds = new Set(requiredHabits.map(h => h.id))
  
  // Get date range
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - days + 1)
  
  const dateRange = getDateRange(startDate, today)
  
  // Group check-ins by date
  const checkInsByDate = new Map<string, Set<string>>()
  for (const checkIn of checkIns) {
    if (!checkInsByDate.has(checkIn.date)) {
      checkInsByDate.set(checkIn.date, new Set())
    }
    checkInsByDate.get(checkIn.date)!.add(checkIn.habit_id)
  }
  
  // Count days with all required done
  let completedDays = 0
  for (const dateStr of dateRange) {
    const completedToday = checkInsByDate.get(dateStr) || new Set()
    const allRequiredDone = [...requiredIds].every(id => completedToday.has(id))
    if (allRequiredDone) completedDays++
  }
  
  return {
    rate: Math.round((completedDays / days) * 100),
    completed: completedDays,
    total: days
  }
}

/**
 * Calculate per-habit completion stats
 */
export function calculateHabitStats(
  checkIns: HabitCheckIn[],
  habits: Habit[],
  days: number = 14
): Array<{
  habit: Habit
  completionRate: number
  totalCheckIns: number
  totalDays: number
}> {
  // Get date range
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - days + 1)
  
  const dateRange = getDateRange(startDate, today)
  
  // Count check-ins per habit
  const habitCheckIns = new Map<string, number>()
  for (const checkIn of checkIns) {
    if (dateRange.includes(checkIn.date)) {
      habitCheckIns.set(
        checkIn.habit_id,
        (habitCheckIns.get(checkIn.habit_id) || 0) + 1
      )
    }
  }
  
  return habits.map(habit => {
    const totalCheckIns = habitCheckIns.get(habit.id) || 0
    return {
      habit,
      completionRate: Math.round((totalCheckIns / days) * 100),
      totalCheckIns,
      totalDays: days
    }
  })
}

/**
 * Get an encouraging message based on stats
 */
export function getEncouragingMessage(
  currentStreak: number,
  weekRate: number
): string {
  if (currentStreak >= 30) {
    return "Incroyable ! Tu es une machine ! 🏆"
  }
  if (currentStreak >= 14) {
    return "Two weeks strong! Keep it up! 💪"
  }
  if (currentStreak >= 7) {
    return "One week streak! You're building momentum! 🌟"
  }
  if (currentStreak >= 3) {
    return "Great start! Three days in a row! ✨"
  }
  if (weekRate >= 80) {
    return "Awesome week! Almost perfect! 🎯"
  }
  if (weekRate >= 50) {
    return "Good progress this week! Keep pushing! 💫"
  }
  if (currentStreak === 0) {
    return "Today is a fresh start! Let's go! 🌱"
  }
  return "Every day counts. You've got this! 💜"
}
