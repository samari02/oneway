# Clarity — Concept & Vision

> Un copilote pour rester dans le droit chemin.
> Pas un surveillant qui punit, mais un allié qui te ramène quand tu dérives.

---

## 🎯 Mission

Aider les utilisateurs à **voir clair** — éliminer les distractions, ancrer les bonnes habitudes, et devenir la meilleure version d'eux-mêmes.

---

## 🧠 Philosophie

| Principe | Description |
|----------|-------------|
| **Simple** | Pas de features inutiles, pas de friction |
| **Intelligent** | Le système s'adapte aux objectifs de l'utilisateur |
| **Bienveillant** | Encourage, ne punit pas |
| **Configurable** | Chacun définit son niveau de strictness |
| **Anti-stress** | L'app réduit l'anxiété, elle n'en ajoute pas |

---

## 👤 Persona cible

- Quelqu'un qui veut reprendre le contrôle de son temps
- Conscient que les distractions numériques l'empêchent d'avancer
- Prêt à s'engager mais a besoin d'un système pour tenir
- Ne veut pas d'une app culpabilisante ou complexe

---

## 🚀 Onboarding (5 premières minutes)

### Step 1 — Le problème
> "Qu'est-ce qui te freine aujourd'hui ?"

- [ ] Je me couche trop tard
- [ ] Je scroll au lieu de bosser
- [ ] Je n'arrive pas à tenir une routine
- [ ] Je manque d'énergie le matin
- [ ] Autre : ___

### Step 2 — Le Best Self
> "À quoi ressemble ta meilleure version ?"

- À quelle heure tu veux te lever ?
- À quelle heure tu veux être off screens ?
- Quels habits tu veux ancrer ?

### Step 3 — Le niveau d'aide
> "Comment tu veux que Clarity t'aide ?"

| Mode | Description |
|------|-------------|
| 🟢 **Gentle** | Je track, je te rappelle, mais je bloque rien |
| 🟡 **Guided** | Je bloque les distractions, bypass possible (tracké) |
| 🔴 **Strict** | Pas d'accès tant que la routine n'est pas faite |

### Step 4 — Setup automatique
Le système configure automatiquement :
- Les habits basés sur les objectifs
- Les sites à bloquer
- Le schedule (matin/soir)

---

## 📱 Expérience quotidienne

### Vue principale — Timeline
- Liste des habits du jour sur une timeline
- Swipe ou tap pour marquer comme fait
- Progression visible (3/5 complétés)

### Nudges
- **Notifications macOS** à des moments clés
- **Block screen** quand tu ouvres un site bloqué
- **Menubar icon** (optionnel) : état de la routine

### Le soir
- Couvre-feu configurable (ex: 20h30)
- Wind-down progressif possible
- Block complet avec bypass d'urgence (challenge requis en mode strict)

---

## 🔒 Blocking

### Basé sur les objectifs
| Objectif déclaré | Blocking auto |
|------------------|---------------|
| Moins de social media | Twitter, Insta, TikTok, Reddit... |
| Me coucher plus tôt | Couvre-feu progressif le soir |
| Moins de porn | Sites adultes |
| Plus de focus travail | Distractions pendant heures de travail |

### Customisation
- L'utilisateur peut ajouter/retirer des sites
- Catégories pré-définies + liste custom

### Bypass selon strictness
| Mode | Bypass |
|------|--------|
| 🟢 Gentle | Un clic |
| 🟡 Guided | Confirmation + tracké dans l'historique |
| 🔴 Strict | Challenge (taper une phrase, compter, attendre 30s) |

---

## 📊 Données & Stats

### Niveau 1 — Streak
```
🔥 14 jours consécutifs
```

### Niveau 2 — Weekly Review
```
Cette semaine :
- Routine matin : 6/7 jours ✓
- Sites bloqués : 12 tentatives
- Couché avant 21h30 : 5/7
```

### Niveau 3 — Pattern Insights
```
💡 Tu bypass plus souvent le dimanche soir
💡 Quand tu skip la méditation, tu scroll 2x plus
```

---

## 🎨 Design & Esthétique

### Vibe
| Élément | Direction |
|---------|-----------|
| **Style** | Headspace, Ghibli, calm tech |
| **Couleurs** | Pastels doux, mint/turquoise dominant |
| **Espacement** | Aéré, beaucoup de blanc |
| **Forme** | Rounded, soft, pas d'angles durs |
| **Stress** | Anti-anxiety design — calme, pas oppressant |

### Palette suggérée
- **Primary** : Mint / Turquoise clair (#7DD8C4 ish)
- **Background** : Blanc cassé / Crème
- **Accent** : Corail doux ou jaune pastel
- **Text** : Gris foncé (pas noir pur)

### Typo
- Rounded, friendly (ex: Nunito, Quicksand, Poppins)
- Pas de serif, pas de corporate

---

## 🐙 Mascotte — Le petit compagnon

### Concept
- Petit blob/goutte avec pattes fines
- Inspiré des Susuwatari (boules de suie Ghibli)
- Texture légèrement fuzzy/douce
- Yeux expressifs, bouche simple

### Personnalité
- Innocent, attachant
- On veut pas le décevoir
- Réagit à tes actions (content, endormi, inquiet...)

### États
| État | Apparence |
|------|-----------|
| Matin, pas commencé | 😴 Endormi |
| En cours | 😊 Encourageant |
| Habit complété | 🎉 Content, petite animation |
| Streak | ✨ Brille, évolue |
| Tu tries de bypass | 🙈 "Hmm, t'es sûr ?" |
| Block screen | 🛡️ Protecteur mais doux |

### Évolution possible (futur)
- Le perso grandit/évolue avec ton streak
- Débloquer des variantes (couleurs, accessoires)

---

## 💬 Tone of Voice

**Ami direct** — pas de bullshit, pas de condescendance.

| Situation | Message |
|-----------|---------|
| Matin | "Allez, on s'y met" |
| Habit done | "Nice 👊" |
| Streak | "3 jours d'affilée, on continue" |
| Skip hier | "Pas grave, on reprend aujourd'hui" |
| Block screen | "T'avais dit que tu voulais éviter ça" |
| Bypass | "Ok, c'est noté" (pas de jugement) |

---

## 🏗️ Architecture technique

| Composant | Tech |
|-----------|------|
| Desktop app | Tauri + React + TypeScript |
| Extension | Chrome MV3 |
| Backend | Supabase (Postgres + Auth) |
| Sync | Multi-device via Supabase |

---

## 📋 Features par priorité

### V1 — MVP utilisable
- [ ] Habits custom (CRUD)
- [ ] Check quotidien (swipe/tap)
- [ ] Streaks
- [ ] Mode strict basique (habits → unlock)
- [ ] Blocking rules (liste de sites)
- [ ] Extension Chrome pour le blocking

### V2 — Experience complète
- [ ] Onboarding intelligent
- [ ] Routines matin/soir
- [ ] Notifications macOS
- [ ] Weekly review
- [ ] Bypass avec challenge
- [ ] Mascotte animée

### V3 — Intelligence
- [ ] Pattern insights
- [ ] Suggestions basées sur le comportement
- [ ] Best Self profile
- [ ] Évolution du personnage

---

## 🚫 Non-goals (pour l'instant)

- Mobile app
- Social features
- Gamification excessive
- Analytics lourdes
- System-wide blocking (hors browser)

---

## 📝 Naming

| Élément | Nom |
|---------|-----|
| **App** | Clarity |
| **Tagline** | "See clear. Stay sharp." ou "Your focus copilot" |
| **Mascotte** | À définir (le petit blob) |
