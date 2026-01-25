# Screen Time - Vue Unifiée

## Vue d'ensemble

Screen Time est la vue principale de l'application qui combine toutes les statistiques d'utilisation en une interface unifiée. Elle remplace les anciennes vues séparées "Stats" et "Apps".

## Philosophie

**"One view to rule them all"** - L'utilisateur ne devrait pas avoir à naviguer entre plusieurs onglets pour comprendre son temps d'écran. Web browsing et apps natifs sont traités comme une seule métrique : le temps passé devant l'écran.

## Composants

### 1. Overview Tab (Vue principale)

La vue Overview affiche :

#### Hero Section
- **Total Screen Time Card** : Temps total combiné (web + apps) avec breakdown
  - Design : carte verte avec effet glow animé
  - Affiche la période sélectionnée (date ou "Last 7 days", etc.)
- **Focus Score Card** : Score de concentration avec mascotte et trend

#### Top Sites (unifié)
Utilise le composant `TopSitesCard` avec les fonctionnalités :
- **Source Filter** : All / Web / Apps
- **Category Filter** : All / Focus / Neutral / Distraction
- **Limit Selector** : Top 10 / 20 / 30
- **Reclassification inline** : Cliquer sur le dot coloré pour changer la catégorie
- **Classification Modal** : "Improve classification" pour classifier en masse

#### Quick Stats Grid
4 cards avec métriques clés :
- Sites visités
- Apps utilisés
- Focus score
- Plus de temps sur (Web vs Apps)

### 2. Browsing Tab (Détails web)

Vue détaillée pour le browsing web avec :
- Heatmap d'activité
- Distribution temporelle
- Historique détaillé

### 3. Apps Tab (Détails apps)

Vue détaillée pour les apps natives avec :
- Total app time
- Distribution par catégorie
- Liste complète des apps

### 4. Habits Tab

Suivi des habitudes définies par l'utilisateur.

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐
│  Rust Backend   │     │ Chrome Extension │
│  (app_monitor)  │     │  (browsing data) │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         │ Tauri invoke          │ Supabase sync
         ▼                       ▼
┌─────────────────────────────────────────────┐
│              React Frontend                  │
│  ┌─────────────────────────────────────┐    │
│  │           OverviewTab               │    │
│  │  ┌───────────┐  ┌────────────────┐  │    │
│  │  │ useAppUsage│  │useBrowsingStats│  │    │
│  │  └─────┬─────┘  └───────┬────────┘  │    │
│  │        │                │           │    │
│  │        └───────┬────────┘           │    │
│  │                ▼                    │    │
│  │         allSites: SiteVisit[]       │    │
│  │                │                    │    │
│  │                ▼                    │    │
│  │          TopSitesCard              │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## Type SiteVisit (étendu)

```typescript
interface SiteVisit {
  domain: string           // Nom du site ou de l'app
  visits: number           // Nombre de visites (1 pour apps)
  timeSpent: number        // Minutes
  category: 'productive' | 'neutral' | 'distraction'
  source: 'web' | 'app'    // Nouveau: source de la donnée
  bundleId?: string        // Pour apps: identifiant unique
  iconData?: string        // Pour apps: icône base64
}
```

## TopSitesCard - Props

```typescript
interface TopSitesCardProps {
  sites: SiteVisit[]
  period?: Period
  defaultPeriod: Period
  onPeriodChange?: (period: Period | null) => void
  onClassificationSave?: (classifications: Record<string, SiteCategory>) => void
  showSourceFilter?: boolean  // Affiche le filtre All/Web/Apps
}
```

## Classification

### Fonctionnement actuel
- **Web** : Classifications sauvegardées via `save_site_classifications` (Rust)
- **Apps** : UI de reclassification fonctionnelle, persistence backend TODO

### Catégories
| Catégorie | Couleur | Description |
|-----------|---------|-------------|
| Focus (productive) | Vert #7DD8C4 | Travail, développement, productivité |
| Neutral | Gris #A8B4C4 | Utilitaires, inclassables |
| Distraction | Orange/Rouge #FF8A65 | Réseaux sociaux, vidéos, divertissement |

## Fichiers clés

```
apps/desktop/src/features/stats/
├── components/
│   ├── OverviewTab.tsx      # Vue principale unifiée
│   ├── TopSitesCard.tsx     # Liste sites+apps avec filtres
│   ├── FocusScoreCard.tsx   # Score de concentration
│   ├── BrowsingView.tsx     # Détails web
│   └── AppsTab.tsx          # Détails apps
├── hooks/
│   ├── useBrowsingStats.ts  # Type SiteVisit étendu
│   └── useBrowsingStatsWithOverride.ts
└── index.ts
```

## TODO

- [ ] Persistence backend pour classification des apps
- [ ] Inclure apps dans le calcul du Focus Score
- [ ] Améliorer détection automatique des catégories d'apps
