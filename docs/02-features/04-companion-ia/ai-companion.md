# AI Companion — Documentation

> Le coach IA intégré dans Clarity.

---

## Concept

L'AI Companion est un **coach conversationnel** intégré directement dans l'interface. Contrairement à un chatbot externe, il :
- Connaît le contexte utilisateur (habits, goals, progress)
- Peut agir sur l'app (créer habits, modifier times, etc.)
- Se souvient des conversations précédentes

### Mission

> "Clarity connecte ta vie digitale et ta vie personnelle pour les aligner vers ce qui compte vraiment pour toi."

L'AI est le pont entre l'intention (North Star) et l'action (habits quotidiens).

---

## Architecture

### Composants

```
features/ai-companion/
├── components/
│   ├── AICompanion.tsx    # Composant principal
│   └── AICompanion.css    # Styles
└── index.ts               # Export

lib/
└── openai.ts              # Service API + mémoire
```

### Flow de données

```
User clicks "Parle-moi"
        ↓
AICompanion expands
        ↓
User selects mode (or types)
        ↓
buildContext() → UserContext
        ↓
refineGoal(goal, messages, context) → OpenAI API
        ↓
Response displayed + saved to Supabase
```

### Contexte passé à l'AI

| Donnée | Source | Usage |
|--------|--------|-------|
| `displayName` | user_settings | Personnalisation ("Hey Sam!") |
| `currentGoal` | user_settings.north_star_goal | Comprendre l'objectif |
| `habits` | habits table | Connaître le setup actuel |
| `wakeTime/sleepTime` | user_settings | Adapter les suggestions |
| `previousConversations` | ai_conversations | Mémoire |
| `checkedIds` | habit_check_ins (today) | Progrès du jour |

### Mémoire

Les conversations sont stockées dans `ai_conversations` :
- 1 row par user (upsert)
- `messages`: JSON array des échanges
- `context`: snapshot du contexte au moment de la convo

---

## Modes de conversation

| Mode | Description | Comportement AI |
|------|-------------|-----------------|
| 🎯 North Star | Travailler sur l'objectif principal | Explorer le pourquoi, raffiner, décomposer |
| 🔧 Habitudes | Gérer les habits | Créer, ajuster times, optimiser |
| 📊 Progrès | Analyser les patterns | Check-ins, streaks, blocages |
| 📝 Tâches | Daily tasks | Placeholder (v2) |

Chaque mode injecte un `systemContext` spécifique dans le prompt.

---

## Prompt Engineering

Le system prompt est construit dynamiquement avec :

1. **Personnalité** : Chaleureux, patient, curieux
2. **Approche** : Comprendre avant de conseiller
3. **Contexte user** : Tout ce qu'on sait sur l'utilisateur
4. **Mode context** : Instructions spécifiques au mode choisi
5. **Conversations passées** : Résumé des échanges précédents

### Règles clés
- Répond dans la langue de l'user
- Questions courtes et percutantes
- Une question à la fois
- Ne rush pas vers les suggestions

---

## Next Steps

### Phase 1 — UI Polish ✨ (current)
- [ ] Pills élégantes au lieu de gros boutons
- [ ] Typing animation (lettre par lettre)
- [ ] Chat flow plus naturel
- [ ] Scroll to bottom automatique

### Phase 2 — Actions directes
- [ ] AI peut créer un habit → bouton [+ Ajouter]
- [ ] AI peut modifier un time → bouton [Changer à 7:30]
- [ ] "Apply all suggestions" en un clic
- [ ] Feedback visuel quand action exécutée

### Phase 3 — Proactivité
- [ ] Nudges basés sur les patterns ("Tu skip souvent X...")
- [ ] Célébrations automatiques (streaks, milestones)
- [ ] Suggestions contextuelles (heure, jour)

### Phase 4 — Analyse digitale
- [ ] Intégration extension Chrome
- [ ] Analyse browsing history
- [ ] Corrélation usage ↔ habits
- [ ] Digital health score

### Phase 5 — Tasks
- [ ] Table `tasks` + migration
- [ ] Mode "Mes tâches" fonctionnel
- [ ] AI aide à définir les tâches du jour
- [ ] Breakdown objectifs → semaines → jours

---

## API Reference

### `refineGoal(goal, messages, context)`
Envoie une conversation à OpenAI avec contexte.

### `saveConversation(userId, messages, context)`
Sauvegarde la conversation dans Supabase.

### `loadConversation(userId)`
Charge la dernière conversation.

### `getPreviousConversationsSummary(userId)`
Retourne un résumé texte des échanges passés.

### `buildContext()`
Construit l'objet `UserContext` depuis les props.

---

## Configuration

### Modèle
Actuellement : `gpt-4o-mini` (économique)
Peut être changé dans `lib/openai.ts` :
```typescript
const MODEL = 'gpt-4o-mini' // ou 'gpt-4o', 'gpt-4-turbo'
```

### Clé API
Stockée dans `localStorage` (client-side only).
Configurable dans Settings → AI Features.

---

## Voir aussi

- **Widget Aoi dans le navigateur** (bulle en bas à droite sur les pages web) : [aoi-widget/aoi_floating_widget_browser_2026-03-28.md](./aoi-widget/aoi_floating_widget_browser_2026-03-28.md) — autre surface produit que ce document (coach dans l’app desktop).

---

*Dernière mise à jour : 2026-01-10*
