/** Placeholder data for clarity home — used when real hooks have no data yet. */

export const MOCK_INTENTION = {
  text: 'Work on Clarity MVP',
  description: 'Ship the home dashboard and wire up session tracking.',
  progress: 0.62,
  focusedMinutes: 142,
  targetMinutes: 240,
}

export const MOCK_HERO = {
  status: "You're on track",
  focusedLabel: '21m focused',
  sparkline: [8, 14, 12, 20, 18, 26, 22, 30, 28, 24, 32, 21],
}

export const MOCK_SESSION = {
  elapsed: '01:24:17',
  mode: 'Deep Work',
  onTrack: true,
  progress: 0.72,
  progressLabel: '72%',
  sites: [
    { name: 'Cursor', favicon: '⌘' },
    { name: 'GitHub', favicon: '🐙' },
    { name: 'Notion', favicon: '📝' },
  ],
}

export const MOCK_FOCUS_HELPERS = [
  { id: 'blocklist', icon: '🛡', label: 'Site blocklist', detail: '12 blocked' },
  { id: 'shield', icon: '🔒', label: 'Distraction shield', detail: 'Active', active: true },
  { id: 'breaks', icon: '☕', label: 'Smart breaks', detail: 'Every 90 min' },
  { id: 'sounds', icon: '🎵', label: 'Focus sounds', detail: 'Forest' },
]

export const MOCK_INSIGHTS = [
  { label: 'Focused time', value: '16h 42m', trend: '+12%', bars: [30, 42, 38, 50, 55, 48, 60, 58, 65, 70] },
  { label: 'Sessions completed', value: '8', trend: '+3', bars: [20, 35, 28, 40, 32, 45, 38, 50, 42, 48] },
  { label: 'Distractions avoided', value: '37', trend: '+8', bars: [40, 55, 48, 62, 58, 72, 68, 80, 75, 87] },
]

export const MOCK_FOOTER_BANNER =
  "Small steps, every day, lead to who you want to become. I'm proud of you."

export const MOCK_CURRENT_FOCUS = {
  title: 'Avatar Animations',
  tag: 'Deep Work',
  startedLabel: 'Started yesterday',
  totalTime: '2h 15m total',
  todayMinutes: 45,
  goalMinutes: 90,
}

export type OpenTaskCategory = {
  id: string
  label: string
  count: number
  color: string
  icon: string
}

export const MOCK_OPEN_TASKS: OpenTaskCategory[] = [
  { id: 'clarity', label: 'Clarity', count: 4, color: '#7c3aed', icon: '✦' },
  { id: 'work', label: 'Work', count: 2, color: '#3b82f6', icon: '◈' },
  { id: 'health', label: 'Health', count: 1, color: '#22c55e', icon: '♥' },
  { id: 'learning', label: 'Learning', count: 3, color: '#f59e0b', icon: '◉' },
]
