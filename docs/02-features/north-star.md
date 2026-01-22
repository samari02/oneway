# North Star Goal — Feature Spec

> Un objectif principal toujours visible qui donne du sens aux habits quotidiens.

---

## 🎯 Concept

L'utilisateur définit **un goal principal** (North Star) qui représente ce qu'il veut accomplir. Ce goal est :
- Toujours visible dans le dashboard
- Lié à ses habits quotidiens
- Raffiné avec l'aide de l'IA

---

## 📐 UI Flow

### 1. Définition (Onboarding — nouvelle étape)

```
┌─────────────────────────────────────────┐
│                                         │
│     🎯 What's your North Star?          │
│                                         │
│  What do you want to achieve?           │
│  Don't worry about being precise,       │
│  we'll help you refine it.              │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ I want to be healthier          │    │
│  └─────────────────────────────────┘    │
│                                         │
│           [Continue →]                  │
│                                         │
└─────────────────────────────────────────┘
```

### 2. Raffinement IA (Onboarding — étape suivante)

```
┌─────────────────────────────────────────┐
│                                         │
│  ✨ Let's make it clearer               │
│                                         │
│  You said: "I want to be healthier"     │
│                                         │
│  Here's a more actionable version:      │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 💪 Build a consistent fitness   │    │
│  │    routine and feel energized   │    │
│  │    every day                    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ○ Use this  ● Edit it  ○ Keep mine    │
│                                         │
│  Suggested habits to get there:         │
│                                         │
│  ☑ 🏃 Exercise 30min (3x/week)          │
│  ☑ 🧘 Morning stretch (daily)           │
│  ☑ 😴 Sleep before 11pm                 │
│  ☐ 🥗 Meal prep on Sundays              │
│                                         │
│        [Looks good! →]                  │
│                                         │
└─────────────────────────────────────────┘
```

### 3. Dashboard — Affichage permanent

```
┌─────────────────────────────────────────────────┐
│ ☐ ☐ ☐        Clarity              👤           │
├─────────────────────────────────────────────────┤
│         │                                       │
│  Today  │   [Mascot]  Hi Sam!                   │
│  Stats  │                                       │
│  ⚙️     │   Today                               │
│         │   Friday Jan 10    🎯 Be healthier ✏️ │  ← À droite de la date
│         │                                       │
│         │   ○ 07:00  Morning stretch            │
│         │   ○ 08:00  Exercise                   │
│         │   ...                                 │
└─────────────────────────────────────────────────┘
```

**Design du goal inline :**
- Petit badge/pill avec icône + texte tronqué
- Hover → texte complet en tooltip
- Clic → Modal d'édition
- Style subtil (pas trop prominent)

### 4. Modal d'édition

```
┌─────────────────────────────────────┐
│  Edit North Star               ✕   │
├─────────────────────────────────────┤
│                                     │
│  Icon: 💪 🎯 📚 🧘 💼 🎨 ❤️ ✨      │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Build a consistent fitness  │    │
│  │ routine and feel energized  │    │
│  └─────────────────────────────┘    │
│                                     │
│  [✨ Refine with AI]                │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  Linked habits (3):                 │
│  ☑ 🏃 Exercise 30min                │
│  ☑ 🧘 Morning stretch               │
│  ☑ 😴 Sleep before 11pm             │
│  ☐ 📖 Read 30 pages                 │
│                                     │
│  [+ Suggest more habits]            │
│                                     │
│        [Cancel]  [Save]             │
└─────────────────────────────────────┘
```

### 5. Stats — Progress Card

```
┌─────────────────────────────────────┐
│  🎯 North Star                      │
│                                     │
│  "Build a consistent fitness        │
│   routine and feel energized"       │
│                                     │
│  ████████████░░░░░░  67%            │
│  Based on 3 linked habits           │
│                                     │
│  🔥 12 days consistent              │
└─────────────────────────────────────┘
```

---

## 🤖 AI Integration

### Raffinement du goal

**Input utilisateur :** "I want to be healthier"

**Prompt IA :**
```
Transform this vague goal into a clear, motivating, actionable statement.
Keep it personal and inspiring, not corporate.
Max 10 words.

User goal: "{input}"
```

**Output :** "Build a consistent fitness routine and feel energized every day"

### Suggestion d'habits

**Prompt IA :**
```
Based on this goal, suggest 3-5 daily/weekly habits.
Format: emoji + short name + frequency
Keep it realistic and achievable.

Goal: "{refined_goal}"
```

**Output :**
- 🏃 Exercise 30min (3x/week)
- 🧘 Morning stretch (daily)
- 😴 Sleep before 11pm (daily)
- 🥗 Meal prep (weekly)

---

## 🗃️ Data Model

```sql
-- Add to user_settings or create new table
ALTER TABLE user_settings
ADD COLUMN north_star_goal text,
ADD COLUMN north_star_icon text DEFAULT '🎯',
ADD COLUMN north_star_created_at timestamptz;

-- Link habits to goal
ALTER TABLE habits
ADD COLUMN linked_to_north_star boolean DEFAULT false;
```

```typescript
// Types
interface NorthStar {
  goal: string
  icon: string
  created_at: string
}

interface Habit {
  // ... existing fields
  linked_to_north_star?: boolean
}
```

---

## 📋 Implementation Plan

### Phase 1: Basic
- [ ] Migration DB (north_star fields)
- [ ] Onboarding step: Define North Star (simple input)
- [ ] Dashboard: Display inline (à droite de la date)
- [ ] Edit modal (sans IA)
- [ ] Link habits to goal (checkbox)

### Phase 2: AI-Powered
- [ ] AI refinement (OpenAI/Claude API)
- [ ] AI habit suggestions
- [ ] Onboarding flow with AI step
- [ ] "Refine with AI" button in edit modal

### Phase 3: Progress
- [ ] Stats card with progress
- [ ] Calculate % based on linked habits
- [ ] Streaks per goal

---

## 🎨 Design Notes

- **Inline display** : Pill/badge style, subtle, à droite de la date
- **Hover** : Tooltip avec texte complet
- **Edit icon** : Apparaît au hover (✏️)
- **Colors** : Utiliser `--color-gold` ou accent pour le goal
- **Animation** : Subtle pulse quand tous les linked habits sont done

---

*Document créé: 2026-01-10*
