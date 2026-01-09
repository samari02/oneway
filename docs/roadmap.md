# Roadmap — Clarity

## ✅ Phase 0: Foundations (Done)

- [x] Monorepo setup (pnpm workspace)
- [x] `packages/shared` — types de base
- [x] Supabase project + tables + RLS
- [x] Scaffold Tauri + React
- [x] Auth (email/password)
- [x] Concept & Vision doc

---

## ✅ Phase 1: Habit Management (Done)

> Objectif : Pouvoir créer, voir et compléter ses habits quotidiens.

### 1.1 Backend ready
- [x] Vérifier/ajuster schéma Supabase pour habits
- [x] API layer dans features/habits/api

### 1.2 UI Habits
- [x] Liste des habits (fetch depuis Supabase)
- [x] Créer un habit (AddHabitForm)
- [x] Check/uncheck habit du jour
- [ ] Éditer / Supprimer un habit (V2)
- [ ] Afficher streak par habit (V2)

### 1.3 Design refresh
- [x] Passer au nouveau design (Clarity vibes)
- [x] Palette mint/pastels
- [x] Typo rounded (Nunito)

---

## 📦 Phase 2: Chrome Extension

> Objectif : Bloquer les sites dans Chrome, contrôlé par l'app.

### 2.1 Extension setup
- [ ] Manifest V3 scaffold
- [ ] Build pipeline (vite/rollup)
- [ ] `@oneway/shared` integration

### 2.2 Blocking core
- [ ] `declarativeNetRequest` rules
- [ ] Block page custom (avec mascotte)
- [ ] Sync rules depuis Supabase

### 2.3 Communication App ↔ Extension
- [ ] Extension lit blocking_state depuis Supabase
- [ ] Refresh rules quand habits complétés

---

## 🔒 Phase 3: Blocking Logic

> Objectif : Connecter habits et blocking (mode strict).

### 3.1 Blocking state
- [ ] UI toggle mode (Gentle/Guided/Strict)
- [ ] Sauvegarder mode dans user_settings
- [ ] Logic : habits required → unlock

### 3.2 Block screen
- [ ] Design block page (Clarity style)
- [ ] Afficher progression routine
- [ ] Bypass selon mode (clic / confirm / challenge)

### 3.3 Evening curfew
- [ ] Config heure de couvre-feu
- [ ] Block automatique le soir

---

## 🎨 Phase 4: Polish V1

> Objectif : App utilisable au quotidien.

### 4.1 Notifications
- [ ] Notifications macOS (rappels habits)
- [ ] Config heures de notification

### 4.2 Stats basiques
- [ ] Streak global
- [ ] Weekly summary (X/7 jours)

### 4.3 Onboarding
- [ ] Flow onboarding (problèmes → goals → mode)
- [ ] Setup auto des habits suggérés
- [ ] Setup auto des sites à bloquer

### 4.4 Finitions
- [ ] Menubar icon (optionnel)
- [ ] Error handling propre
- [ ] Multi-device sync vérifié

---

## 🚀 Phase 5: Distribution

- [ ] Build production Tauri (.app)
- [ ] Publish extension Chrome Web Store
- [ ] Landing page simple
- [ ] Dogfooding intensif

---

## 🔮 Backlog V2+

- [ ] Pattern insights
- [ ] Mascotte animée (états)
- [ ] Évolution du personnage
- [ ] Routines nommées (matin/soir)
- [ ] Deep linking (magic link → app)
- [ ] Best Self profile détaillé
- [ ] Suggestions intelligentes

---

## Current Focus

```
Phase 2 — Chrome Extension
```

Prochaine action : Scaffold extension Chrome MV3 avec blocking.
