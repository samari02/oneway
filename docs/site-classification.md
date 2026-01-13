# Site Classification Feature

## Overview

Manual site classification allows users to override the default categorization of websites to improve focus score accuracy.

## Categories

| Category | Icon | Color | Impact |
|----------|------|-------|--------|
| 🎯 Focus (productive) | Green dot | `#5BB5A0` | Increases focus score |
| ⚪ Neutral | Gray dot | `#8E99A8` | Neutral impact |
| 🔥 Distraction | Red dot | `#E74C3C` | Decreases focus score |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                            │
├─────────────────────────────────────────────────────────────────┤
│  TopSitesCard / SettingsView                                    │
│       │                                                         │
│       ▼                                                         │
│  SiteClassificationModal                                        │
│       │ - Loads existing from backend on open                   │
│       │ - User clicks to classify sites                         │
│       │ - Save button calls onSave(classifications)             │
│       ▼                                                         │
│  BrowsingView.handleClassificationSave()                        │
│       │                                                         │
│       ▼                                                         │
│  invoke('save_site_classifications', { classifications })       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Rust/Tauri)                        │
├─────────────────────────────────────────────────────────────────┤
│  lib.rs                                                         │
│       │ save_site_classifications(HashMap<String, String>)      │
│       ▼                                                         │
│  browsing_data.rs                                               │
│       │ save_site_classifications() - merges with existing      │
│       │ BrowsingStorage::save_classifications()                 │
│       ▼                                                         │
│  ~/.clarity/clarity-data/classifications.json                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Opening the Modal

```typescript
// SiteClassificationModal.tsx
useEffect(() => {
  if (!isOpen) return
  
  const existing = await invoke<Record<string, string>>('get_site_classifications')
  // Initialize state with existing classifications
  sites.forEach(site => {
    initial[site.domain] = existing[site.domain] || null
  })
})
```

### 2. User Interaction

- Click on a category circle → sets classification for that domain
- Click same circle again → toggles off (sets to null)
- Only classified sites (non-null) are sent on Save

### 3. Saving

```typescript
// handleSave in SiteClassificationModal
const toSave: Record<string, SiteCategory> = {}
Object.entries(classifications).forEach(([domain, category]) => {
  if (category) {
    toSave[domain] = category  // Only save non-null
  }
})
onSave(toSave)
```

### 4. Backend Storage

```rust
// browsing_data.rs
pub fn save_site_classifications(classifications: HashMap<String, String>) -> Result<(), String> {
    let mut existing = storage.read_classifications();
    for (domain, category) in classifications {
        existing.insert(domain, category);  // Merge
    }
    storage.save_classifications(&existing)
}
```

### 5. Stats Calculation

```rust
// browsing_data.rs - calculate_stats()
let user_classifications = self.read_classifications();

for visit in &visits {
    // User override takes priority
    let effective_category = user_classifications
        .get(&visit.domain)
        .cloned()
        .unwrap_or_else(|| visit.category.clone());
    
    match effective_category.as_str() {
        "productive" | "work" | "dev" => productive_count += 1,
        "distraction" | "social_media" => distraction_count += 1,
        _ => neutral_count += 1,
    }
}
```

## Storage

**File:** `~/.clarity/clarity-data/classifications.json`

```json
{
  "twitter.com": "distraction",
  "github.com": "productive",
  "notion.so": "productive"
}
```

---

## Known Issues & Debugging

### Issue: Save doesn't persist changes

**Symptoms:**
- User classifies sites in modal
- Clicks Save
- Reopening modal shows sites as unclassified

**Debugging Steps:**

1. **Check browser console** for errors after clicking Save
2. **Check Rust logs** in terminal running `pnpm tauri dev`
3. **Verify file was written:**
   ```bash
   cat ~/.clarity/clarity-data/classifications.json
   ```

**Potential causes:**
- [ ] `invoke()` call failing silently
- [ ] Rust command not receiving data
- [ ] File write permission issue
- [ ] Data format mismatch (frontend sends different format than Rust expects)

### Issue: All sites were "neutral"

**Root cause:** Modal initialized sites with `'neutral'` instead of `null`, then saved all of them.

**Fix:** 
- Sites now start as `null` (unclassified)
- Only explicitly classified sites are saved
- Modal loads existing classifications on open

---

## What We Tried

### Attempt 1: Basic Implementation
- Created modal with ★ ◇ ✕ icons
- Problem: Icons unclear, needed labels

### Attempt 2: Labels + Emojis
- Added 🎯 Focus / ⚪ Neutral / 🔥 Distraction labels
- Made modal wider (720px)
- Problem: Save button invisible in dark mode

### Attempt 3: Fix Dark Mode + Persistence
- Fixed Save button color (white text)
- Added Rust backend for persistence
- Problem: All sites were classified as "neutral"

### Attempt 4: Fix Neutral Bug
- Changed initialization from `'neutral'` to `null`
- Modal now loads existing from backend
- Only saves explicitly classified sites
- Problem: **Save still not working** (current issue)

---

## Next Steps to Debug

1. Add `console.log` before `invoke()` to see what data is being sent
2. Add `eprintln!` in Rust to see what data is received
3. Check if the file is actually being written
4. Verify the Tauri command is properly registered
