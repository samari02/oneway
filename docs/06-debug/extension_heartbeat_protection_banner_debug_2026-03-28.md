# Debug — Bannière « Protection compromised » / heartbeats extension

**Last update:** 2026-03-28

---

## 1. Symptôme produit

- L’app desktop **Clarity** (Tauri) affiche une bannière **« Protection Compromised »** (niveau **critical**) dans les vues Boundaries / alerte de protection.
- Le texte indique un **délai très long** depuis le dernier signal de l’extension, du type :  
  `No signal from extension for Xm Ys ago. Please check that the extension is enabled.`
- Ce délai est calculé côté UI à partir de **`last_heartbeat`** (timestamp du dernier heartbeat reçu par le **native messaging host** et persisté dans `~/.clarity/extension-status.json`).
- **Observation clé :** en rechargeant manuellement l’extension Chrome (`chrome://extensions` → Recharger), la bannière disparaît et le statut redevient cohérent — ce qui suggère un **état côté extension** (port natif / service worker) plutôt qu’un simple « réseau déconnecté ».

---

## 2. Chaîne technique (rappel)

| Étape | Rôle |
|--------|------|
| Extension MV3 (service worker) | Ouvre un `chrome.runtime.Port` via `connectNative('com.clarity.app')`, envoie périodiquement des messages `HEARTBEAT`. |
| Binaire natif (mode `--native-host`) | Lit stdin (protocole Chrome Native Messaging), traite les messages, met à jour `~/.clarity/extension-status.json` (dont `last_heartbeat`, `heartbeat_count`, `alert_level`). |
| App desktop (React) | Poll `get_extension_status` (Tauri) ~toutes les 5 s via `useExtensionStatus` et affiche `ProtectionAlert` si `alert_level !== 'ok'`. |

Seuils côté Rust (fichier `native_host.rs`) : **warning** après ~90 s sans heartbeat, **critical** après ~5 min.

---

## 3. Hypothèses de cause (non toutes prouvées par des logs)

1. **Port natif « zombie »** : après veille / suspension, le `Port` reste non nul côté extension alors que la session avec le host est morte ; `connectToDesktopApp()` fait un **early return** si `port` existe déjà, donc **pas de nouveau `connectNative`** tant qu’on ne recharge pas l’extension.
2. **Service worker MV3** : timers (`setInterval` pour le heartbeat) et l’état du SW peuvent être incohérents après une longue suspension ; un **rechargement** du SW réinitialise tout.
3. **Processus natif** : le host peut terminer sur EOF ; Chrome respawn un nouveau process à la prochaine connexion — si l’extension ne se reconnecte pas, **aucun nouveau heartbeat** n’atteint le disque.

---

## 4. Correctifs déjà intégrés (code)

Emplacement : dépôt **oneway**, surtout `apps/extension` et `apps/desktop`.

| Changement | Fichier / zone | But |
|------------|----------------|-----|
| Permission **`idle`** | `apps/extension/manifest.json` | Utiliser l’API `chrome.idle` pour détecter le retour **active** après **idle** / **locked**. |
| **`setupIdleReconnect()`** | Fin de `apps/extension/src/background/native-messaging.ts` | Sur transition vers `active` après `idle` ou `locked`, appeler `disconnectFromDesktopApp()` puis `connectToDesktopApp()` pour recréer le port (effet proche d’un rechargement manuel). |
| **`maybeReconnectAfterHeartbeatFailure()`** | `native-messaging.ts` | Si l’envoi du heartbeat échoue (`postMessage` → `sendToDesktop` retourne `false` ou exception), forcer une reconnexion avec **cooldown 120 s** pour éviter une boucle si le desktop est fermé. |

L’instrumentation de debug décrite ci‑dessous **n’a pas été retirée** au moment de la rédaction ; à nettoyer une fois le comportement validé en conditions réelles.

---

## 5. Instrumentation de debug ajoutée

### 5.1 Extension (TypeScript)

**Fichier :** `apps/extension/src/background/native-messaging.ts`

- Requêtes **`fetch`** vers l’endpoint d’ingest de session debug (voir § 5.4), dans des blocs `// #region agent log` :
  - **`onDisconnect`** du port natif : log `port_disconnect` + message d’erreur Chrome.
  - **`sendHeartbeat`** : `heartbeat_attempt` (état `isConnected`, `hasPort`), `heartbeat_skipped_not_connected`, `heartbeat_post` (`posted`, timestamp), `heartbeat_error`.

**Objectif :** voir si, au moment du bug, les heartbeats sont **skippés**, **postés en échec**, ou si le port **se déconnecte** sans reconnexion utile.

### 5.2 Application desktop (React)

**Fichier :** `apps/desktop/src/features/boundaries/hooks/useExtensionStatus.ts`

- Après chaque `invoke('get_extension_status')`, **`fetch`** avec `last_heartbeat`, `alert_level`, `connected`.

**Objectif :** confirmer ce que l’UI reçoit réellement (pas seulement l’affichage) et corréler avec le fichier sur disque.

### 5.3 Native host (Rust)

**Fichier :** `apps/desktop/src-tauri/src/native_host.rs`

- Fonction **`agent_debug_ndjson`** : append une ligne **NDJSON** sur le disque (chemin absolu fixé pour la session Cursor — voir § 5.4).
- Appelée dans **`update_heartbeat`** après persistance : `heartbeat_persisted` + `heartbeat_count`, `last_heartbeat_ms`.
- Appelée quand le host reçoit **EOF** (`extension_eof_native_host_exiting`).

**Objectif :** prouver si le **host Rust** reçoit encore des `HEARTBEAT` après veille, et si le process se termine (EOF).

### 5.4 Endpoint / fichier de log (session Cursor)

> Ces valeurs sont **propres à une session d’outillage** ; si tu relances une session debug ultérieure, vérifie les constantes indiquées dans les instructions agent (endpoint, chemin, `sessionId`).

| Élément | Valeur (session utilisée lors de l’instrumentation) |
|---------|-----------------------------------------------------|
| Endpoint HTTP ingest | `http://127.0.0.1:7380/ingest/57142764-769f-4ca9-ac2e-b433ea5b37af` |
| Fichier NDJSON | `/Users/samuelmarinelli/Development/apps/onelearn-web/.cursor/debug-ead3dc.log` |
| Session | `ead3dc` (header `X-Debug-Session-Id` + champ `sessionId` dans le JSON) |

**Limite observée :** si le serveur d’ingest n’est pas démarré ou si le `fetch` depuis l’extension est bloqué, **aucune ligne** n’apparaît dans le fichier ; les logs **Rust** (append direct) peuvent toutefois compléter si le binaire instrumenté tourne.

---

## 6. Fichiers et commandes utiles (sans instrumentation)

| Ressource | Usage |
|-----------|--------|
| `~/.clarity/extension-status.json` | Vérifier `last_heartbeat` (ms epoch), `heartbeat_count`, `alert_level` au moment du bug. |
| Console du service worker | `chrome://extensions` → Clarity → **Service worker** (inspecter) : logs `log(...)` de `native-messaging.ts`. |
| Host natif | Le host est lancé par Chrome ; en dev, s’assurer que le binaire pointé par le manifest natif correspond au build **oneway** récent. |

---

## 7. Que faire quand le problème réapparaît

1. **Ne pas recharger l’extension tout de suite** (pour garder l’état « bugué » quelques minutes si tu veux capturer des preuves).
2. **Noter l’heure**, si la machine était en **veille**, **écran verrouillé**, ou **Chrome en arrière-plan**.
3. **Vérifier `~/.clarity/extension-status.json`** : `last_heartbeat` remonte-t-il si tu attends 1–2 min avec Chrome au premier plan ?
4. **Ouvrir la console du service worker** et chercher : `Disconnected`, `Reconnect scheduled`, `Cannot send heartbeat`, `Heartbeat native reconnect`, `Idle: active after idle/locked`.
5. Si une session debug Cursor est active avec ingest :
   - supprimer le fichier de log de session indiqué par l’outil (un seul fichier par session) ;
   - relancer app + extension, reproduire, puis **récupérer le NDJSON** (extension + éventuellement lignes Rust).
6. **Comparer** :
   - logs extension (**heartbeat_post** `posted: false` vs `true`) ;
   - logs Rust (**heartbeat_persisted** vs absence de lignes pendant plusieurs minutes) ;
   - JSON disque vs `get_extension_status` dans l’UI (hook TS).
7. **Si le correctif idle + échec heartbeat ne suffit pas** : envisager une évolution suivante (ex. **`chrome.alarms`** pour le heartbeat au lieu de `setInterval`, ou reconnexion sur un événement explicite au réveil système — à trancher selon les preuves).

---

## 8. Fichiers code concernés (références rapides)

- `apps/extension/src/background/native-messaging.ts` — connexion, heartbeat, idle reconnect, instrumentation.
- `apps/extension/manifest.json` — permissions (`nativeMessaging`, `idle`, …).
- `apps/desktop/src-tauri/src/native_host.rs` — persistance statut, boucle host, instrumentation NDJSON.
- `apps/desktop/src/features/boundaries/hooks/useExtensionStatus.ts` — poll statut.
- `apps/desktop/src/features/boundaries/components/ProtectionAlert.tsx` — texte de la bannière.

---

## 9. Nettoyage ultérieur

Une fois le comportement validé sur plusieurs cycles (veille / verrouillage / desktop fermé) :

- retirer les blocs `// #region agent log` + `fetch` dans l’extension et le hook React ;
- retirer `agent_debug_ndjson` et ses appels dans `native_host.rs` ;
- mettre à jour la date dans le nom de ce fichier si le contenu change substantiellement.
