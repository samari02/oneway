# Architecture & Best Practices

> Document de référence pour toutes les décisions techniques.
> À consulter AVANT de coder une nouvelle feature.

---

## Table des matières

1. [Stack Overview](#stack-overview)
2. [Structure du projet](#structure-du-projet)
3. [Desktop App Architecture](#desktop-app-architecture)
4. [Data Layer](#data-layer)
5. [State Management](#state-management)
6. [Component Patterns](#component-patterns)
7. [Naming Conventions](#naming-conventions)
8. [Error Handling](#error-handling)
9. [Extension Architecture](#extension-architecture)
10. [Communication Patterns](#communication-patterns)
11. [Testing Strategy](#testing-strategy)
12. [Git Workflow](#git-workflow)

---

## Stack Overview

| Layer | Tech | Rôle |
|-------|------|------|
| Desktop App | **Tauri 2** + **React 19** + **TypeScript** | App native macOS |
| Extension | **Chrome MV3** + **TypeScript** | Blocage sites |
| Shared | **TypeScript** | Types, utils, constants |
| Backend | **Supabase** (Postgres + Auth + Realtime) | Data + Auth |
| Styling | **CSS Modules** ou **Vanilla CSS** | Pas de Tailwind |

### Pourquoi ces choix

| Choix | Raison |
|-------|--------|
| Tauri vs Electron | 10x plus léger, Rust secure |
| React vs Solid/Svelte | Écosystème, familiarité, stable |
| CSS vs Tailwind | Contrôle total, pas de classes utility |
| Supabase vs Firebase | Open source, Postgres, RLS natif |
| pnpm vs npm/yarn | Workspaces, rapide, strict |

---

## Structure du projet

```
clarity/
├── apps/
│   ├── desktop/                    # Tauri + React
│   │   ├── src/
│   │   │   ├── app/                # App shell, routing, providers
│   │   │   ├── features/           # Feature modules
│   │   │   ├── components/         # Shared UI components
│   │   │   ├── hooks/              # Shared custom hooks
│   │   │   ├── lib/                # Utilities, clients
│   │   │   ├── styles/             # Global styles, variables
│   │   │   └── main.tsx            # Entry point
│   │   ├── src-tauri/              # Rust backend
│   │   └── package.json
│   │
│   └── extension/                  # Chrome MV3
│       ├── src/
│       │   ├── background/         # Service worker
│       │   ├── content/            # Content scripts
│       │   ├── popup/              # Popup UI (si besoin)
│       │   ├── blocked/            # Block page
│       │   └── lib/                # Shared utils
│       ├── manifest.json
│       └── package.json
│
├── packages/
│   └── shared/                     # Shared code
│       └── src/
│           ├── types/              # TypeScript interfaces
│           ├── schemas/            # Validation schemas (zod)
│           ├── constants/          # Config, URLs
│           ├── utils/              # Pure functions
│           └── index.ts            # Public API
│
├── supabase/
│   ├── migrations/                 # SQL migrations versionnées
│   └── seed.sql                    # Data de dev (optionnel)
│
└── docs/                           # Documentation
```

---

## Desktop App Architecture

### Feature-based organization

Chaque feature est un module autonome :

```
src/features/
├── habits/
│   ├── components/
│   │   ├── HabitList.tsx
│   │   ├── HabitItem.tsx
│   │   ├── HabitForm.tsx
│   │   └── HabitList.css
│   ├── hooks/
│   │   ├── useHabits.ts
│   │   ├── useCreateHabit.ts
│   │   └── useCheckHabit.ts
│   ├── api/
│   │   └── habits.ts               # Supabase queries
│   ├── types.ts                    # Types locaux si besoin
│   └── index.ts                    # Public exports
│
├── blocking/
│   ├── components/
│   ├── hooks/
│   ├── api/
│   └── index.ts
│
├── auth/
│   ├── components/
│   │   ├── LoginForm.tsx
│   │   └── AuthGuard.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useUser.ts
│   ├── api/
│   │   └── auth.ts
│   └── index.ts
│
└── settings/
    └── ...
```

### Règles d'import

```typescript
// ✅ CORRECT — import depuis l'index public
import { HabitList, useHabits } from '@/features/habits'

// ❌ INTERDIT — import direct dans les internals
import { HabitItem } from '@/features/habits/components/HabitItem'

// ✅ CORRECT — shared components
import { Button, Card } from '@/components'

// ✅ CORRECT — shared package
import { Habit, SUPABASE_URL } from '@oneway/shared'
```

### Path aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@oneway/shared": ["../../packages/shared/src"]
    }
  }
}
```

---

## Data Layer

### Supabase Client

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@oneway/shared'
import type { Database } from '@oneway/shared/types/database'

export const supabase = createClient<Database>(
  SUPABASE_URL, 
  SUPABASE_ANON_KEY
)
```

### API Layer Pattern

Chaque feature a son fichier `api/` avec les queries Supabase :

```typescript
// src/features/habits/api/habits.ts
import { supabase } from '@/lib/supabase'
import type { Habit, HabitCheckIn } from '@oneway/shared'

export async function getHabits(userId: string): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('order')
  
  if (error) throw error
  return data
}

export async function createHabit(habit: Omit<Habit, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('habits')
    .insert(habit)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function checkHabit(habitId: string, userId: string, date: string) {
  const { data, error } = await supabase
    .from('habit_check_ins')
    .upsert({ habit_id: habitId, user_id: userId, date })
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function uncheckHabit(habitId: string, date: string) {
  const { error } = await supabase
    .from('habit_check_ins')
    .delete()
    .eq('habit_id', habitId)
    .eq('date', date)
  
  if (error) throw error
}
```

### Custom Hooks (Data Fetching)

```typescript
// src/features/habits/hooks/useHabits.ts
import { useState, useEffect } from 'react'
import { getHabits } from '../api/habits'
import type { Habit } from '@oneway/shared'

interface UseHabitsResult {
  habits: Habit[]
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useHabits(userId: string | undefined): UseHabitsResult {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetch = async () => {
    if (!userId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const data = await getHabits(userId)
      setHabits(data)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch()
  }, [userId])

  return { habits, loading, error, refetch: fetch }
}
```

### Mutation Hooks

```typescript
// src/features/habits/hooks/useCreateHabit.ts
import { useState } from 'react'
import { createHabit } from '../api/habits'
import type { Habit } from '@oneway/shared'

interface UseCreateHabitResult {
  create: (habit: Omit<Habit, 'id' | 'created_at'>) => Promise<Habit>
  loading: boolean
  error: Error | null
}

export function useCreateHabit(): UseCreateHabitResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = async (habit: Omit<Habit, 'id' | 'created_at'>) => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await createHabit(habit)
      return data
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Unknown error')
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { create, loading, error }
}
```

---

## State Management

### Principe : Local first, global si nécessaire

| Type de state | Solution |
|---------------|----------|
| Server state (Supabase data) | Custom hooks + useState |
| UI state local (modal open, form values) | useState |
| UI state partagé (theme, sidebar) | React Context |
| Auth state | React Context (AuthProvider) |

### AuthContext Example

```typescript
// src/features/auth/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

---

## Component Patterns

### Component Structure

```typescript
// src/features/habits/components/HabitItem.tsx
import { useState } from 'react'
import type { Habit } from '@oneway/shared'
import './HabitItem.css'

interface HabitItemProps {
  habit: Habit
  isChecked: boolean
  onCheck: (habitId: string) => void
  onUncheck: (habitId: string) => void
}

export function HabitItem({ habit, isChecked, onCheck, onUncheck }: HabitItemProps) {
  const handleToggle = () => {
    if (isChecked) {
      onUncheck(habit.id)
    } else {
      onCheck(habit.id)
    }
  }

  return (
    <div className="habit-item">
      <span className="habit-icon">{habit.icon}</span>
      <span className="habit-name">{habit.name}</span>
      <button 
        className={`habit-check ${isChecked ? 'checked' : ''}`}
        onClick={handleToggle}
        aria-label={isChecked ? 'Uncheck habit' : 'Check habit'}
      >
        {isChecked ? '✓' : '○'}
      </button>
    </div>
  )
}
```

### Container vs Presentational

```typescript
// Container : gère la logique et les données
// src/features/habits/components/HabitListContainer.tsx
export function HabitListContainer() {
  const { user } = useAuth()
  const { habits, loading, error } = useHabits(user?.id)
  const { todayCheckIns } = useTodayCheckIns(user?.id)
  const { check } = useCheckHabit()
  const { uncheck } = useUncheckHabit()

  if (loading) return <Loader />
  if (error) return <ErrorMessage error={error} />

  return (
    <HabitList 
      habits={habits}
      checkIns={todayCheckIns}
      onCheck={check}
      onUncheck={uncheck}
    />
  )
}

// Presentational : pure UI, reçoit tout en props
// src/features/habits/components/HabitList.tsx
interface HabitListProps {
  habits: Habit[]
  checkIns: HabitCheckIn[]
  onCheck: (habitId: string) => void
  onUncheck: (habitId: string) => void
}

export function HabitList({ habits, checkIns, onCheck, onUncheck }: HabitListProps) {
  const checkedIds = new Set(checkIns.map(c => c.habit_id))

  return (
    <div className="habit-list">
      {habits.map(habit => (
        <HabitItem
          key={habit.id}
          habit={habit}
          isChecked={checkedIds.has(habit.id)}
          onCheck={onCheck}
          onUncheck={onUncheck}
        />
      ))}
    </div>
  )
}
```

### Shared UI Components

```
src/components/
├── Button/
│   ├── Button.tsx
│   ├── Button.css
│   └── index.ts
├── Card/
├── Modal/
├── Input/
├── Loader/
├── ErrorMessage/
└── index.ts                 # Barrel export
```

```typescript
// src/components/Button/Button.tsx
import './Button.css'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({ 
  variant = 'primary', 
  size = 'md',
  loading,
  children,
  disabled,
  ...props 
}: ButtonProps) {
  return (
    <button 
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  )
}
```

---

## Naming Conventions

### Files

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `HabitList.tsx` |
| Hooks | camelCase, prefix `use` | `useHabits.ts` |
| Utils/API | camelCase | `habits.ts`, `formatDate.ts` |
| Types | camelCase | `types.ts` |
| Styles | Same as component | `HabitList.css` |
| Constants | camelCase | `constants.ts` |

### Code

```typescript
// Components: PascalCase
function HabitList() {}

// Hooks: camelCase, prefix use
function useHabits() {}

// Functions: camelCase, verb first
function getHabits() {}
function createHabit() {}
function handleClick() {}

// Constants: SCREAMING_SNAKE_CASE
const SUPABASE_URL = '...'
const MAX_HABITS = 10

// Types/Interfaces: PascalCase
interface Habit {}
type HabitStatus = 'active' | 'archived'

// Boolean variables: prefix is/has/should
const isLoading = true
const hasError = false
const shouldRefetch = true
```

### CSS Classes

```css
/* BEM-inspired, kebab-case */
.habit-list {}
.habit-item {}
.habit-item--checked {}
.habit-item__icon {}
.habit-item__name {}

/* State classes */
.is-loading {}
.is-active {}
.has-error {}
```

---

## Error Handling

### API Level

```typescript
// src/features/habits/api/habits.ts
export class HabitError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'HabitError'
  }
}

export async function getHabits(userId: string): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
  
  if (error) {
    throw new HabitError(error.message, error.code)
  }
  
  return data
}
```

### Component Level

```typescript
// src/components/ErrorBoundary.tsx
import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <button onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

### UI Error Display

```typescript
// src/components/ErrorMessage/ErrorMessage.tsx
interface ErrorMessageProps {
  error: Error
  onRetry?: () => void
}

export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  return (
    <div className="error-message">
      <p>{error.message}</p>
      {onRetry && (
        <button onClick={onRetry}>Réessayer</button>
      )}
    </div>
  )
}
```

---

## Extension Architecture

```
apps/extension/src/
├── background/
│   └── index.ts              # Service worker
├── blocked/
│   ├── index.html            # Block page
│   ├── index.tsx
│   └── styles.css
├── lib/
│   ├── supabase.ts           # Supabase client
│   ├── rules.ts              # declarativeNetRequest helpers
│   └── storage.ts            # chrome.storage helpers
└── types/
    └── chrome.d.ts
```

### Background Service Worker

```typescript
// apps/extension/src/background/index.ts
import { supabase } from '../lib/supabase'
import { updateBlockingRules } from '../lib/rules'

// Listen for auth changes
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed')
})

// Sync blocking rules periodically
chrome.alarms.create('sync-rules', { periodInMinutes: 5 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'sync-rules') {
    await syncBlockingRules()
  }
})

async function syncBlockingRules() {
  const { data: rules } = await supabase
    .from('blocking_rules')
    .select('*')
    .eq('is_active', true)
  
  if (rules) {
    await updateBlockingRules(rules)
  }
}
```

---

## Communication Patterns

```
┌─────────────────┐         ┌─────────────────┐
│  Desktop App    │         │   Extension     │
│  (Tauri/React)  │         │  (Chrome MV3)   │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │    ┌─────────────┐        │
         └────►  Supabase   ◄────────┘
              │  (Postgres)  │
              └─────────────┘

1. Desktop modifie habits/blocking_rules
2. Supabase stocke les données
3. Extension poll ou subscribe (Realtime)
4. Extension update ses declarativeNetRequest rules
```

### Realtime Subscription (Extension)

```typescript
// apps/extension/src/lib/realtime.ts
import { supabase } from './supabase'

export function subscribeToBlockingChanges(
  userId: string,
  onUpdate: () => void
) {
  return supabase
    .channel('blocking_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'blocking_state',
        filter: `user_id=eq.${userId}`,
      },
      onUpdate
    )
    .subscribe()
}
```

---

## Testing Strategy

### Niveaux de test

| Niveau | Quoi | Outils |
|--------|------|--------|
| Unit | Utils, hooks purs | Vitest |
| Integration | Components + API | Vitest + Testing Library |
| E2E | Flows complets | Playwright (futur) |

### Structure

```
src/features/habits/
├── __tests__/
│   ├── habits.api.test.ts
│   ├── useHabits.test.ts
│   └── HabitList.test.tsx
```

### Example Test

```typescript
// src/features/habits/__tests__/useHabits.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { useHabits } from '../hooks/useHabits'
import { getHabits } from '../api/habits'

vi.mock('../api/habits')

describe('useHabits', () => {
  it('fetches habits on mount', async () => {
    const mockHabits = [{ id: '1', name: 'Test' }]
    vi.mocked(getHabits).mockResolvedValue(mockHabits)

    const { result } = renderHook(() => useHabits('user-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.habits).toEqual(mockHabits)
  })
})
```

---

## Git Workflow

### Commits

```bash
# Format
#N Description courte (impératif)

# Examples
#6 Add habit list component
#7 Fix streak calculation bug
#8 Refactor auth flow
```

### Branches (si besoin plus tard)

```
main              # Production ready
├── feat/habits   # Feature branch
├── fix/auth      # Bug fix
└── refactor/ui   # Refactoring
```

---

## Checklist avant PR/Merge

- [ ] TypeScript compile sans erreur
- [ ] Pas de `any` explicite
- [ ] Components ont des props typées
- [ ] Hooks suivent le pattern établi
- [ ] CSS suit la convention BEM
- [ ] Pas d'import de fichiers internes d'autres features
- [ ] Error handling en place
- [ ] Console.log nettoyés

---

## Principes fondamentaux

1. **Explicit > Implicit** — Pas de magie, code lisible
2. **Colocation** — Code proche de où il est utilisé
3. **Single Responsibility** — Un fichier = une chose
4. **Types everywhere** — Le compilateur est ton ami
5. **Fail fast** — Erreurs claires, early return
6. **DRY but not too DRY** — Dupliquer avant d'abstraire trop tôt
