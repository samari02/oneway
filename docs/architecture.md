# Architecture & Best Practices

## Stack Overview

| Layer | Tech | Rôle |
|-------|------|------|
| Desktop App | **Tauri** (Rust) + **React** (TS) | App native macOS, UI principale |
| Extension | **Chrome MV3** (TS) | Blocage sites dans le browser |
| Shared | **TypeScript** | Types, schémas, constantes |
| Backend | **Supabase** | Auth, DB Postgres, sync |

---

## Tauri — C'est quoi ?

Tauri = framework pour créer des apps desktop natives avec un frontend web.

```
┌─────────────────────────────────────┐
│         macOS App (.app)            │
├─────────────────────────────────────┤
│  Frontend (React/TS)                │
│  - Runs in WebView                  │
│  - Same code as any React app       │
├─────────────────────────────────────┤
│  Backend (Rust)                     │
│  - Native APIs (filesystem, etc.)   │
│  - Commands callable from frontend  │
│  - Lightweight (~10MB vs Electron)  │
└─────────────────────────────────────┘
```

### Pourquoi Tauri vs Electron ?

| Tauri | Electron |
|-------|----------|
| ~10MB bundle | ~150MB bundle |
| Rust backend (fast, secure) | Node.js backend |
| Uses system WebView | Ships Chromium |
| Better for simple apps | Better ecosystem |

Pour oneway, Tauri est parfait : app légère, pas besoin de features Electron complexes.

---

## Languages

| Langage | Où | Quand l'écrire |
|---------|-----|----------------|
| **TypeScript** | Frontend React, Extension, Shared | 95% du code |
| **Rust** | Tauri backend | Seulement si besoin d'API native |
| **SQL** | Supabase migrations | Schema changes |

**Règle : Rust minimal.** On utilise Rust uniquement pour ce qu'on ne peut pas faire en TS (ex: accès filesystem sécurisé). Tout le reste en TypeScript.

---

## Structure des dossiers

```
oneway/
├── apps/
│   ├── desktop/
│   │   ├── src/              # React frontend
│   │   ├── src-tauri/        # Rust backend (auto-généré)
│   │   └── package.json
│   └── extension/
│       ├── src/
│       ├── manifest.json     # Chrome MV3
│       └── package.json
├── packages/
│   └── shared/
│       └── src/
│           ├── types/        # Interfaces TypeScript
│           ├── constants.ts  # Config partagée
│           └── index.ts
├── supabase/
│   └── migrations/           # SQL versioned
└── docs/
```

---

## Communication Patterns

### Desktop App ↔ Supabase

```typescript
// Direct via @supabase/supabase-js
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@oneway/shared'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

### Extension ↔ Supabase

```typescript
// Même chose, l'extension a son propre client Supabase
// Auth token stocké dans chrome.storage.local
```

### Desktop ↔ Extension

Pas de communication directe. Les deux sync via Supabase :
1. Desktop modifie `blocking_rules` dans Supabase
2. Extension poll ou subscribe aux changements
3. Extension met à jour ses `declarativeNetRequest` rules

---

## Best Practices

### TypeScript

```typescript
// ✅ Utiliser les types du shared package
import { Habit, BlockingRule } from '@oneway/shared'

// ✅ Strict mode activé
// ✅ Pas de `any` — utiliser `unknown` si nécessaire
// ✅ Prefer interfaces over types pour les objets
```

### React

```typescript
// ✅ Functional components only
// ✅ Hooks pour state management
// ✅ Pas de Redux — trop complexe pour notre use case
// ✅ React Query pour data fetching Supabase
```

### Supabase

```typescript
// ✅ Toujours utiliser RLS (déjà configuré)
// ✅ Pas de service_role key côté client
// ✅ Queries typées avec types générés
```

### Git

```bash
# Format des commits
#N Description courte

# Exemples
#2 Add Tauri desktop app scaffold
#3 Implement habit tracking UI
```

---

## Principes

1. **Simple > Clever** — Code lisible, pas de magie
2. **Types partout** — Le shared package est la source de vérité
3. **Rust minimal** — Seulement pour les besoins natifs
4. **Offline-first mindset** — L'app doit marcher sans connexion
5. **No premature optimization** — Ship first, optimize later
