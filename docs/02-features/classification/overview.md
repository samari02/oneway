# Classification System

## Vue d'ensemble

Le système de classification permet aux utilisateurs de catégoriser leurs sites web et applications en trois catégories pour améliorer le calcul du Focus Score et la visualisation des données.

## Catégories

| Catégorie | Couleur | Description | Exemples |
|-----------|---------|-------------|----------|
| **Focus** (productive) | Vert `#7DD8C4` | Activités productives | GitHub, VS Code, Notion, documentation |
| **Neutral** | Gris `#A8B4C4` | Ni productif ni distrayant | Utilitaires, emails, recherche |
| **Distraction** | Orange `#FF8A65` | Activités distrayantes | YouTube, Twitter, Reddit, jeux |

## Architecture

### Backend (Rust)

**Commandes Tauri :**
```rust
// Sauvegarder les classifications
save_site_classifications(classifications: HashMap<String, String>)

// Récupérer les classifications existantes
get_site_classifications() -> HashMap<String, String>
```

**Stockage :**
- Les classifications sont stockées localement dans le backend Rust
- Format: `{ "domain_or_app_name": "productive" | "neutral" | "distraction" }`
- Unifié pour web et apps (même système de stockage)

### Frontend (React)

**Composants impliqués :**

```
TopSitesCard.tsx
├── Affiche la liste des sites/apps
├── Dot coloré cliquable pour reclassification inline
├── Dropdown avec 3 options (Focus, Neutral, Distraction)
└── Appelle onClassificationSave() au changement

OverviewTab.tsx
├── Charge les classifications au mount via get_site_classifications()
├── Maintient l'état local appClassifications
├── handleClassificationSave() sauvegarde + met à jour l'état local
└── Applique les classifications aux apps dans allSites useMemo

SiteClassificationModal.tsx
├── Modal pour classification en masse
├── Affiche tous les sites avec leur classification actuelle
└── Permet de modifier plusieurs sites à la fois
```

## Flow de données

```
┌─────────────────────────────────────────────────────────────┐
│                        User Action                          │
│              Click dot → Select category                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   TopSitesCard                              │
│    handleInlineReclassify(domain, newCategory)              │
│              ↓                                              │
│    onClassificationSave({ [domain]: newCategory })          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    OverviewTab                              │
│                                                             │
│  1. invoke('save_site_classifications', { classifications })│
│  2. setAppClassifications(prev => ({ ...prev, ...new }))    │
│  3. refetch() pour les sites web                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Rust Backend                             │
│                                                             │
│  save_site_classifications() → stockage local               │
│  get_browsing_stats() → retourne stats avec classifications │
└─────────────────────────────────────────────────────────────┘
```

## Différences Web vs Apps

| Aspect | Sites Web | Applications |
|--------|-----------|--------------|
| **Source de catégorie** | Backend (`get_browsing_stats`) | État local (`appClassifications`) |
| **Classification auto** | Oui (basée sur le domaine) | Non (défaut: neutral) |
| **Stockage** | Même système | Même système |
| **Clé** | Domaine (ex: `github.com`) | Nom de l'app (ex: `Cursor`) |

## Reclassification Inline

L'utilisateur peut reclassifier directement depuis la liste :

1. **Cliquer** sur le dot coloré à côté du nom
2. **Dropdown** apparaît avec 3 options
3. **Sélectionner** la nouvelle catégorie
4. **Mise à jour immédiate** de l'UI + sauvegarde backend

## Classification en masse

Via le bouton "Improve classification" dans TopSitesCard :

1. **Modal** s'ouvre avec tous les sites
2. **Tableau** avec colonnes: Site, Visits, Focus, Neutral, Distraction
3. **Sélection** radio pour chaque site
4. **Save** sauvegarde toutes les modifications

## Fichiers clés

```
apps/desktop/
├── src/features/stats/components/
│   ├── TopSitesCard.tsx          # Liste + reclassification inline
│   ├── OverviewTab.tsx           # Gestion état classifications
│   └── SiteClassificationModal.tsx # Classification en masse
│
└── src-tauri/src/
    └── browsing_data.rs          # Backend Rust (save/get)
```

## Limitations actuelles

- [ ] Pas de classification automatique pour les apps
- [ ] Pas de sync Supabase pour les classifications (local only)
- [ ] Le Focus Score n'inclut pas encore les apps

## TODO

- Implémenter la classification automatique des apps basée sur le bundle ID
- Synchroniser les classifications avec Supabase pour multi-device
- Inclure les apps dans le calcul du Focus Score
