/** Placeholder data for clarity home — used when real hooks have no data yet. */

export const MOCK_INTENTION = {
  text: 'Finish the product roadmap draft',
  progress: 0.62,
  focusedMinutes: 142,
  targetMinutes: 240,
}

export const MOCK_HERO = {
  status: 'In flow',
  statusDetail: 'Deep focus · 43 min',
  sparkline: [12, 18, 22, 28, 24, 32, 38, 35, 42, 48, 44, 52],
}

export const MOCK_SESSION = {
  elapsed: '0:43:12',
  goal: '1h focus block',
  progress: 0.72,
  sites: [
    { name: 'Figma', favicon: '🎨' },
    { name: 'Notion', favicon: '📝' },
    { name: 'Linear', favicon: '◆' },
  ],
}

export const MOCK_FOCUS_HELPERS = [
  { id: 'block', label: 'Block distractions', description: 'Hide social feeds', enabled: true },
  { id: 'noise', label: 'Ambient sound', description: 'Soft rain loop', enabled: true },
  { id: 'breaks', label: 'Gentle breaks', description: 'Remind every 50 min', enabled: false },
]

export const MOCK_INSIGHTS = [
  { label: 'Focus score', value: '87', unit: '%', trend: '+4', bars: [40, 55, 48, 62, 58, 72, 68, 80, 75, 87] },
  { label: 'Intentional time', value: '5h 35m', unit: '', trend: '+22m', bars: [30, 42, 38, 50, 55, 48, 60, 58, 65, 70] },
  { label: 'Sessions', value: '3', unit: 'today', trend: 'on track', bars: [20, 35, 28, 40, 32, 45, 38, 50, 42, 48] },
]

export const MOCK_REFLECTION = {
  prompt: 'What felt meaningful about today?',
  placeholder: 'Capture a quick note before you wrap up…',
  streakDays: 4,
}

export const MOCK_SUPPORT_BANNER =
  'Your attention is a gift — protect it gently, and progress will follow.'

export const MOCK_FOOTER_BANNER =
  'Small consistent steps beat perfect bursts. Rest when you need to — tomorrow is another chance to focus.'
