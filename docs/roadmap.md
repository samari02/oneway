# Roadmap — Clarity

> Vision : Un copilote qui t'aide à voir clair dans ta vie digitale.

---

## ✅ Completed

### Foundations
- [x] Monorepo setup (pnpm workspace)
- [x] `packages/shared` — types de base
- [x] Supabase project + tables + RLS
- [x] Scaffold Tauri + React
- [x] Auth (email/password)
- [x] Concept & Vision doc

### Habits & Calendar
- [x] CRUD habits (create, edit, delete)
- [x] Check/uncheck habit du jour
- [x] Calendar view avec drag & drop
- [x] Timeline view (visual)
- [x] Scheduled times + duration

### North Star & Goals
- [x] North Star goal (direction de vie)
- [x] Goals layer avec progress
- [x] AI refinement (OpenAI)

### Stats & Browsing
- [x] Chrome extension (history collection)
- [x] Native messaging (extension ↔ desktop)
- [x] Browsing stats (top sites, time distribution)
- [x] Site classification (productive/neutral/distracting)
- [x] Period filtering (today, 7d, 30d, all)

### AI Companion (Aoi)
- [x] Empathetic coach with context
- [x] Chat history
- [x] Integrated in header

### Design & UX
- [x] Clarity design system (mint/pastels)
- [x] Mascot (Aoi) with moods
- [x] Dark mode support
- [x] Modal polish (consistent styling)

---

## 🎯 Phase 1: Fermer la Boucle (Current)

> Objectif : Connecter Boundaries ↔ Extension pour un blocking effectif.

### 1.1 Boundaries Management (UI)
- [x] Vue dédiée "Boundaries" dans sidebar
- [x] Liste des boundaries avec:
  - Site/pattern (ex: twitter.com, *.reddit.com)
  - Horaires (time_start → time_end)
  - Mode (block / awareness)
  - Raison (pourquoi cette boundary)
- [x] CRUD boundaries (create, edit, delete)
- [x] Stats par boundary (blocks today, bypasses this week, respect rate)
- [ ] Quick-add depuis Browsing stats ("Block this site")

### 1.2 Sync Boundaries → Extension
- [ ] Native message `SYNC_BOUNDARIES` (desktop → extension)
- [ ] Extension reçoit et stocke les rules
- [ ] Time-based blocking (respecter les horaires)
- [ ] Refresh automatique quand boundary modifiée

### 1.3 Block Page Redesign
- [ ] Design Clarity (mint, bg-elevated)
- [ ] Mascotte Aoi avec message encourageant
- [ ] Afficher la raison de la boundary
- [ ] Bypass avec tracking (guided mode)

### 1.4 Mode Awareness
- [ ] Option par boundary: block vs awareness
- [ ] Toast/notification au lieu de bloquer
- [ ] "Tu visites Twitter. C'est dans tes boundaries."
- [ ] L'user décide, Clarity informe

### 1.5 Stats: Boundary Violations
- [ ] Compter les violations par boundary
- [ ] Afficher dans Stats (violations today, this week)
- [ ] Correlation avec habits dans Aoi

---

## 🧠 Phase 2: Intelligence

> Objectif : Aoi devient proactive et fait des connexions.

### 2.1 Pattern Insights
- [ ] Détecter corrélations (skip habit → more browsing)
- [ ] Aoi suggère des insights automatiquement
- [ ] Weekly digest des patterns

### 2.2 Focus Blocks
- [ ] Créneaux protégés dans le calendrier
- [ ] Blocking renforcé pendant focus time
- [ ] Intégration avec habits (ex: "Deep Work 9h-12h")

### 2.3 Proactive Aoi
- [ ] Un message par jour (bien choisi)
- [ ] Célébrer les wins ("3 jours de streak!")
- [ ] Alerter doucement ("Tu te couches tard ces jours-ci")

### 2.4 Evening Wind-down
- [ ] Config heure de couvre-feu
- [ ] Écran qui se "réchauffe" visuellement
- [ ] Blocages progressifs
- [ ] Suggestion: "Prêt à fermer?"

### 2.5 Notifications macOS
- [ ] Rappels habits (configurable)
- [ ] Alertes boundary violations
- [ ] Summary fin de journée

---

## 🌟 Phase 3: Écosystème

> Objectif : Clarity devient un hub de bien-être digital.

### 3.1 Intégrations Santé
- [ ] Apple Health / Google Fit (sommeil)
- [ ] Strava (workouts auto-trackés)
- [ ] Aoi connecte les dots (sommeil ↔ habits)

### 3.2 Mobile Companion
- [ ] App read-only (voir habits, check/uncheck)
- [ ] Push notifications
- [ ] Sync avec desktop

### 3.3 Weekly Review
- [ ] Aoi prépare un résumé chaque dimanche
- [ ] Points forts, points à améliorer
- [ ] Suggestions pour la semaine

### 3.4 Advanced Blocking
- [ ] Mode Strict (challenge pour bypass)
- [ ] Scheduled blocking (ex: weekends only)
- [ ] Whitelist par contexte (work vs personal)

### 3.5 Distribution
- [ ] Build production Tauri (.app, .dmg)
- [ ] Chrome Web Store (extension)
- [ ] Landing page
- [ ] Dogfooding intensif

---

## 🔮 Backlog (Future)

- [ ] Mascotte animée (états dynamiques)
- [ ] Évolution du personnage (grandit avec streaks)
- [ ] Routines nommées (matin/soir)
- [ ] Deep linking (magic link → app)
- [ ] Best Self profile détaillé
- [ ] Communauté (opt-in, anonyme)
- [ ] API pour développeurs

---

## Current Focus

```
Phase 1.2 — Sync Boundaries → Extension
```

Prochaine action : Implémenter la synchronisation boundaries → extension pour le blocking effectif.
