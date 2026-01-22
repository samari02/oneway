# Feature Ideas — Clarity

> Ce fichier contient les idées de fonctionnalités futures, organisées par priorité et domaine.  
> Différent de `roadmap.md` qui track l'implémentation concrète.

---

## 🎯 Habits & Tasks

### Habits (existant, à améliorer)
- [ ] **Habits par jour de la semaine** — certains habits seulement le lundi, etc.
- [ ] **Habits conditionnels** — "Si je fais X, alors Y devient optionnel"
- [ ] **Habit templates** — starter packs (Morning Routine, Evening Wind-down, etc.)
- [ ] **Habit notes** — ajouter une note quand on check (humeur, difficulté, etc.)
- [ ] **Skip avec raison** — "Pas fait car malade" vs "Pas fait car flemme"

### Tasks (nouveau)
- [ ] **Tasks ponctuelles** — to-dos qui disparaissent une fois faits
- [ ] **Tasks récurrentes** — "Chaque lundi: meal prep"
- [ ] **Tasks liées à un projet** — grouper les tasks par projet/objectif
- [ ] **Due dates** — avec rappels
- [ ] **Priorités** — P1/P2/P3 ou High/Medium/Low

---

## 📅 Visualisation du temps

### Day View
- [ ] **Day Blocks** — blocs visuels proportionnels à la durée des habits
- [ ] **Timeline améliorée** — ligne du temps avec marqueur "maintenant"
- [ ] **Time slots libres** — montrer les gaps dans la journée

### Week View
- [ ] **Calendar semaine** — vue 7 jours avec completion par jour
- [ ] **Drag & drop** — réorganiser les habits sur la semaine
- [ ] **Patterns visuels** — couleurs par type d'habit

### Month View
- [ ] **Heatmap GitHub-style** — intensité = % completion
- [ ] **Vue calendrier classique** — avec dots pour les jours complétés
- [ ] **Comparaison mois vs mois** — évolution

---

## 📊 Stats & Analytics

### Basiques (V1)
- [ ] **Current streak** — jours consécutifs avec X% completion
- [ ] **Best streak** — record historique
- [ ] **Completion rate** — 7 jours / 30 jours / all time
- [ ] **Habits completion** — % par habit individuel

### Avancées (V2)
- [ ] **Patterns temporels** — "Tu es plus efficace le matin"
- [ ] **Weak spots** — "Méditation souvent skipée le lundi"
- [ ] **Corrélations** — "Quand tu fais du sport, tu médites 80% du temps"
- [ ] **Prédictions** — "Basé sur tes patterns, risque de skip demain"

### Gamification
- [ ] **Badges/Achievements** — "7 jours streak!", "Premier mois!"
- [ ] **Niveaux** — XP system basé sur consistency
- [ ] **Challenges** — "Cette semaine: 100% sur méditation"

---

## 🚫 Blocking (Extension Chrome)

### Règles
- [ ] **Block lists intelligentes** — basées sur les objectifs "Best Self"
- [ ] **Allowlist temporaire** — "Débloquer 15min pour recherche"
- [ ] **Block par catégorie** — Social, News, Entertainment, etc.
- [ ] **Block schedules** — différent selon l'heure

### Strictness Levels
- [ ] **Gentle** — notification + timer avant de bloquer
- [ ] **Moderate** — block avec bypass facile
- [ ] **Strict** — block avec challenge (typing test, math, wait timer)
- [ ] **Nuclear** — aucun bypass possible pendant X heures

### Intégration Habits
- [ ] **Habits-gated** — déblocage si habits du matin faits
- [ ] **Progressive unlock** — plus de temps débloqué si streak
- [ ] **Emergency bypass** — avec friction et logging

### Safeguards & Protection avancée
- [ ] **DNS-level blocking** — Backup au niveau réseau via hosts file ou DNS custom (ex: Pi-hole, NextDNS). Fonctionne même sans extension.
- [ ] **Health check & alertes** — L'extension vérifie périodiquement que les règles sont actives. Si protection down → alerte dans desktop app.
- [ ] **Alerte incognito persistante** — Notification récurrente tant que l'extension n'est pas activée en incognito.
- [ ] **"Panic mode"** — Si protection désactivée → bloquer TOUT accès internet jusqu'à résolution (mode optionnel ultra-strict).
- [ ] **Tamper detection** — Détecter si l'extension est désactivée/supprimée et alerter.
- [ ] **Multi-navigateur** — Développer l'extension pour Firefox, Edge.

---

## 🎨 Mascotte & Animations

### États de la mascotte (Goutte/Blob)
- [ ] **Idle** — flotte doucement, respire
- [ ] **Happy** — quand habit complété, petite danse
- [ ] **Encouraging** — quand on ouvre l'app, wave
- [ ] **Sleepy** — tard le soir, baille
- [ ] **Proud** — fin de journée 100%, celebration
- [ ] **Concerned** — streak en danger, worry face

### Animations
- [ ] **Check animation** — confetti subtil ou glow
- [ ] **Streak milestone** — animation spéciale à 7, 30, 100 jours
- [ ] **Transitions** — entre les vues

### Rive Integration
- [ ] **State machine** — transitions fluides entre états
- [ ] **Interactions** — clic sur mascotte = réaction
- [ ] **Contextual** — réagit à l'heure, aux actions

---

## 🔔 Notifications & Nudges

### Rappels
- [ ] **Habit reminders** — "Il est 6h, temps de méditer"
- [ ] **Streak protection** — "Ta streak de 12 jours est en danger!"
- [ ] **Daily summary** — "Hier: 4/5 habits ✓"

### Nudges intelligents
- [ ] **Time-based** — "Tu ouvres Reddit vers 14h, on bloque?"
- [ ] **Pattern-based** — "Lundi tu skip souvent, on te rappelle?"
- [ ] **Motivational** — citations, rappels du "Best Self"

---

## ⚙️ Settings & Personnalisation

### Profil
- [ ] **Best Self definition** — éditable après onboarding
- [ ] **Goals** — objectifs à long terme
- [ ] **Preferences** — dark mode, notifications, etc.

### Data
- [ ] **Export** — CSV/JSON de toutes les données
- [ ] **Import** — depuis autres apps (Habitica, etc.)
- [ ] **Sync** — multi-device via Supabase

---

## 🌐 Multi-platform

### Desktop (Tauri) — En cours
- [ ] **Mac App Store** — packaging et soumission
- [ ] **Windows** — build Windows
- [ ] **Linux** — build Linux

### Extension Chrome — À faire
- [ ] **MV3** — manifest v3
- [ ] **Sync avec desktop** — via Supabase Realtime
- [ ] **Popup** — quick view des habits

### Mobile (Futur)
- [ ] **React Native** ou **Tauri Mobile**
- [ ] **Widget iOS/Android** — quick check
- [ ] **Apple Watch** — complications

### Web (Futur)
- [ ] **Web app** — version SaaS
- [ ] **Landing page** — marketing
- [ ] **Dashboard** — analytics avancées

---

## 💡 Ideas Backlog (non triées)

- Intégration calendrier (Google Calendar, Apple Calendar)
- Pomodoro timer intégré
- Focus mode avec timer
- Journal/notes quotidiennes
- Intégration santé (Apple Health, Google Fit)
- Mode "vacation" — pause sans casser streak
- Social features — accountability partners
- API publique pour intégrations
- Shortcuts/Widgets macOS
- Menu bar app avec quick actions

---

*Dernière mise à jour: 2026-01-10*
