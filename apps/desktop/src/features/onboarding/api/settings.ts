import { supabase } from '@/lib/supabase'
import type { OnboardingData } from '../types'
import { DEFAULT_HABITS } from '../types'

export interface UserSettings {
  user_id: string
  display_name?: string
  morning_routine_habits: string[]
  default_blocking_mode: string
  wake_time?: string
  sleep_time?: string
  screen_off_time?: string
  onboarding_completed: boolean
  updated_at: string
  // North Star
  north_star_goal?: string
  north_star_icon?: string
  north_star_created_at?: string
  // Aoi widget preferences
  aoi_hidden_global?: boolean
  aoi_hidden_domains?: string[]
  // Clarity day routing
  evening_reflection_time?: string
  drift_threshold_minutes?: number
}

export interface AoiPreferences {
  hiddenGlobal: boolean
  hiddenDomains: string[]
}

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned, which is fine
    throw new Error(error.message)
  }

  return data
}

export async function saveOnboardingData(
  userId: string,
  onboardingData: OnboardingData
): Promise<void> {
  // 1. Create user settings
  const { error: settingsError } = await supabase
    .from('user_settings')
    .upsert({
      user_id: userId,
      display_name: onboardingData.displayName,
      default_blocking_mode: onboardingData.strictness,
      wake_time: onboardingData.wakeTime,
      sleep_time: onboardingData.sleepTime,
      screen_off_time: onboardingData.screenOffTime,
      // North Star
      north_star_goal: onboardingData.northStarGoal || null,
      north_star_icon: onboardingData.northStarIcon || '🎯',
      north_star_created_at: onboardingData.northStarGoal ? new Date().toISOString() : null,
      onboarding_completed: true,
      morning_routine_habits: [],
      updated_at: new Date().toISOString(),
    })

  if (settingsError) throw new Error(settingsError.message)

  // 2. Create suggested habits based on problems
  const suggestedHabits = DEFAULT_HABITS.filter(habit =>
    habit.forProblems.some(p => onboardingData.problems.includes(p))
  )

  if (suggestedHabits.length > 0) {
    const habitsToCreate = suggestedHabits.map((habit, index) => ({
      user_id: userId,
      name: habit.name,
      icon: habit.icon,
      order: index,
      is_active: true,
    }))

    const { error: habitsError } = await supabase
      .from('habits')
      .insert(habitsToCreate)

    if (habitsError) throw new Error(habitsError.message)
  }
}

/**
 * Get Aoi preferences for a user
 */
export async function getAoiPreferences(userId: string): Promise<AoiPreferences> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('aoi_hidden_global, aoi_hidden_domains')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }

  return {
    hiddenGlobal: data?.aoi_hidden_global ?? false,
    hiddenDomains: data?.aoi_hidden_domains ?? [],
  }
}

/**
 * Update Aoi preferences for a user
 */
export async function updateAoiPreferences(
  userId: string,
  preferences: AoiPreferences
): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: userId,
      aoi_hidden_global: preferences.hiddenGlobal,
      aoi_hidden_domains: preferences.hiddenDomains,
      updated_at: new Date().toISOString(),
    })

  if (error) throw new Error(error.message)
}
