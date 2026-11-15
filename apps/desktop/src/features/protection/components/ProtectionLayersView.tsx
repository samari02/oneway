import { useState, useEffect, useRef } from 'react'
import { useExtensionStatus } from '@/features/boundaries/hooks/useExtensionStatus'
import { useBlockingLock } from '@/features/boundaries/hooks/useBlockingLock'
import { useHostsBlocking } from '@/features/settings/hooks/useHostsBlocking'
import './ProtectionLayersView.css'

// ─── Layer definitions (truthful, matches actual Clarity architecture) ──────

type Tone = 'mint' | 'amber' | 'red' | 'muted'

interface LayerDef {
  icon: string
  tag: string
  title: string
  lead: string
  action: string
  limit: string
  code: string[]
}

const LAYER_DEFS: Record<string, LayerDef> = {
  dns: {
    icon: 'network',
    tag: 'LAYER 01 · OS & NETWORK',
    title: 'DNS / Cold Turkey',
    lead: 'An upstream DNS filter can stop selected domains before they reach Chrome. Cold Turkey is a separate app.',
    action:
      'A DNS filter denies resolution of a listed domain for all browsers and apps using that resolver. Cold Turkey has its own block list and schedule management.',
    limit:
      'Clarity DNS is not yet built in. Cold Turkey must be installed and configured separately. Resolver choice and per-app VPN tunnels affect DNS coverage.',
    code: ['Clarity DNS · planned', 'Cold Turkey · external'],
  },
  hosts: {
    icon: 'laptop',
    tag: 'LAYER 02 · MACOS',
    title: 'Hosts file',
    lead: 'Clarity can map known adult domains to a sinkhole in /etc/hosts when the feature is enabled.',
    action:
      'The Tauri desktop app writes hostnames to the local hosts file with admin privileges. Any app that honours macOS system name resolution inherits these mappings.',
    limit:
      'Only explicitly listed hostnames are covered. The feature requires root access to update the file. Apps that bypass system DNS (e.g. via their own DoH resolver) are unaffected.',
    code: ['/etc/hosts', 'hosts_adult_blocking', 'enable_hosts_adult_blocking'],
  },
  dnr: {
    icon: 'zap',
    tag: 'LAYER 03 · CHROME EXTENSION',
    title: 'Network rules (DNR)',
    lead: 'When an enabled rule matches the request URL, Chrome blocks or redirects it before the page loads.',
    action:
      'Static declarativeNetRequest rules cover seed domains, imported entries, and selected URL patterns. They target main-frame requests primarily, with some sub-frame coverage.',
    limit:
      'Unlisted URLs without a matching pattern reach later checks. An oversized regex can be silently rejected by Chrome (e.g. rule 12003 before its fix). Requires the extension to be loaded.',
    code: ['rules.json', 'declarativeNetRequest', 'block-screen.html'],
  },
  worker: {
    icon: 'list-filter',
    tag: 'LAYER 04 · CHROME EXTENSION',
    title: 'Navigation rules',
    lead: 'The service worker applies the bundled adult list and evaluates custom rules with Focus state.',
    action:
      'A webNavigation event triggers checks against the adult list in extension storage and rules synced from the desktop. The built-in adult list is designed to stay on even if the native host drops.',
    limit:
      'Custom rule sync and desktop authorisation degrade when the native bridge is offline. Navigation handling can overlap Chrome\'s DNR evaluation.',
    code: ['service-worker.ts', 'webNavigation.onBeforeNavigate', 'adult-blocklist.json', 'GET_CONFIG'],
  },
  scan: {
    icon: 'scan-text',
    tag: 'LAYER 05 · PAGE CONTENT',
    title: 'Page analysis',
    lead: 'A page that passes the address checks can still be flagged based on its visible content.',
    action:
      'The scanner scores title, meta tags, keywords, image ratio, links and tube-like structure. Medical-context logic avoids false positives on health content.',
    limit:
      'The page can appear briefly before intervention at document_idle. Sparse signals can fall below the score threshold. The latest fixes require a rebuilt extension dist.',
    code: ['page-analyzer.ts', 'document_idle', 'warn / block'],
  },
  lock: {
    icon: 'lock-keyhole',
    tag: 'LAYER 06 · PROTECTION CONTROLS',
    title: 'Anti-disable',
    lead: 'Pause friction and optional rule locks slow down impulsive changes to your protection.',
    action:
      'Pausing can require a phrase and a timed delay. Desktop rule changes can be guarded by a password or friction challenge. Chrome managed policies (IncognitoModeAvailability / ExtensionSettings) are configured per-profile.',
    limit:
      'An unpacked extension can still be removed via chrome://extensions without a managed policy. Hardcore restrictions and CRX force-install via managed policy are planned but not yet packaged.',
    code: ['blocking_lock', 'IncognitoModeAvailability', 'ExtensionSettings', '--hardcore · planned'],
  },
  bridge: {
    icon: 'cable',
    tag: 'DEPENDENCY · EXTENSION ↔ DESKTOP',
    title: 'Native bridge',
    lead: 'The native host carries configuration and health signals between Chrome and Clarity desktop.',
    action:
      'The extension connects to com.clarity.app via native messaging. runner.sh starts the desktop binary as the native host, which reads local rules and lock state. Heartbeat loss surfaces a protection warning in the app.',
    limit:
      'When disconnected, desktop sync and lock authorisation are degraded. With the extension still loaded, local DNR and page analysis continue; the adult list is designed to fail closed.',
    code: ['com.clarity.app', 'runner.sh', 'appsdesktop --native-host', '~/.clarity/custom-blocking-rules.json'],
  },
}

// ─── Scenario definitions ───────────────────────────────────────────────────

type StepEntry = [string, string, Tone, string]

interface Scenario {
  title: string
  tone: Tone
  copy: string
  steps: StepEntry[]
}

const OS_STEPS: StepEntry[] = [
  ['dns', 'Skipped', 'muted', 'Cold Turkey and Clarity DNS are external/planned; this scenario has no DNS-level match.'],
  ['hosts', 'Unverified', 'amber', 'This scenario assumes no matching hosts file entry.'],
]
const DNR_MISS: StepEntry = ['dnr', 'No match', 'muted', 'The example URL misses all enabled domain and pattern rules.']
const WORKER_MISS: StepEntry = ['worker', 'No match', 'muted', 'No adult or custom rule in extension storage matches this example.']

const SCENARIOS: Record<string, Scenario> = {
  known: {
    title: 'Blocked before page load', tone: 'mint', copy: 'A Chrome network rule matched the request.',
    steps: [...OS_STEPS, ['dnr', 'Blocked', 'mint', 'An enabled DNR rule matches the top-level request. Chrome does not load the destination document.']],
  },
  custom: {
    title: 'Blocked during navigation', tone: 'mint', copy: 'A synced custom rule matched while Focus was active.',
    steps: [...OS_STEPS, DNR_MISS, ['worker', 'Blocked', 'mint', 'Focus is active and the example matches a synced custom rule. The service worker intervenes.']],
  },
  scan: {
    title: 'Blocked after page appeared', tone: 'amber', copy: 'Page signals crossed the block threshold. A brief flash is possible.',
    steps: [...OS_STEPS, DNR_MISS, WORKER_MISS, ['scan', 'Blocked late', 'amber', 'The DOM was ready when the scanner found enough signals. The page could have been briefly visible.']],
  },
  miss: {
    title: 'Page stayed open', tone: 'red', copy: 'An unlisted page produced too few signals to intervene.',
    steps: [...OS_STEPS, DNR_MISS, WORKER_MISS, ['scan', 'Below threshold', 'red', 'Sparse text and weak structural signals leave this example below both warning and blocking thresholds.']],
  },
  offline: {
    title: 'Local adult list still blocked', tone: 'amber', copy: 'The desktop bridge is offline. Local extension protection caught this example.',
    steps: [
      ['bridge', 'Offline', 'amber', 'Heartbeat is lost. This example assumes the extension is still loaded in Chrome.'],
      ...OS_STEPS, DNR_MISS,
      ['worker', 'Blocked locally', 'mint', 'The bundled adult list in extension storage matched the domain without a fresh desktop response.'],
    ],
  },
  hosts: {
    title: 'Stopped at device resolution', tone: 'mint', copy: 'This scenario assumes hosts blocking is enabled and the hostname is mapped.',
    steps: [['hosts', 'Sinkholed', 'mint', 'The app has mapped this hostname and the client uses system resolution. Hosts blocking must be enabled.']],
  },
  pause: {
    title: 'Pause challenge shown', tone: 'amber', copy: 'The request to pause meets friction. Protection stays on while the challenge is incomplete.',
    steps: [['lock', 'Challenge shown', 'amber', 'The pause flow requires a phrase and a timed delay before continuing.']],
  },
  remove: {
    title: 'Extension can be removed', tone: 'red', copy: 'Removing the unpacked extension takes all three Chrome checks offline.',
    steps: [
      ['lock', 'Removal possible', 'red', 'The unpacked install still exposes a manual removal path. External filters (DNS/hosts) depend on their own config.'],
      ['dnr', 'Unavailable', 'muted', 'Removing the extension takes its DNR rules out of this simulation.'],
      ['worker', 'Unavailable', 'muted', 'Removing the extension takes its navigation service worker out of this simulation.'],
      ['scan', 'Unavailable', 'muted', 'Removing the extension takes its content scanner out of this simulation.'],
    ],
  },
}

// ─── User-friendly stories ───────────────────────────────────────────────────

interface Story {
  icon: string
  when: string
  title: string
  copy: string
  path: string[]
  note: string
}

const STORIES: Record<string, Story> = {
  known: {
    icon: 'zap',
    when: 'BEFORE THE PAGE OPENS',
    title: 'A known site is stopped early',
    copy: "When a site matches Clarity's browser rules, Chrome can stop the request before the page appears.",
    path: ['Open a site', 'Address matches a rule', 'Page blocked'],
    note: "If the address is new to Clarity, the page check can still look for signs of adult content.",
  },
  unknown: {
    icon: 'scan-text',
    when: 'ON THE PAGE',
    title: 'Clarity can catch an unlisted site',
    copy: "If the address passes the first checks, Clarity can look at what the page contains. Enough signals can trigger a warning or a block.",
    path: ['Unlisted address', 'Clarity checks the page', 'Warning or block'],
    note: "The page may appear briefly. Pages with few detectable signals can stay open.",
  },
  pause: {
    icon: 'lock-keyhole',
    when: 'WHEN YOU TRY TO PAUSE',
    title: 'Pausing takes a deliberate step',
    copy: "A phrase and a short wait can interrupt an impulse to pause. You can also set a password or friction challenge to protect changes to your block list.",
    path: ['Request pause', 'Complete the challenge', 'Choose whether to continue'],
    note: "Someone with physical access to the computer may still be able to remove the extension.",
  },
}

// ─── Lucide-like inline SVG icons ────────────────────────────────────────────

const SVG_ICONS: Record<string, React.ReactNode> = {
  network: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>,
  laptop: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></svg>,
  zap: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  'list-filter': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M7 12h10M11 18h2"/></svg>,
  'scan-text': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8h8M7 12h10M7 16h6"/></svg>,
  'lock-keyhole': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="16" r="1"/><rect x="3" y="10" width="18" height="12" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></svg>,
  cable: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1v2"/><path d="M19 15V6.5a3.5 3.5 0 0 0-7 0v11a3.5 3.5 0 0 1-7 0V9"/><path d="M21 21v-2h-4v2"/><path d="M3 5h4V3H3z"/><path d="M5 3v2"/></svg>,
  terminal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  play: <svg viewBox="0 0 24 24" fill="currentColor"><path d="m6 3 15 9-15 9V3z"/></svg>,
  pause: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>,
  'rotate-ccw': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
  'shield-alert': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>,
  'shield-check': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>,
  'chevron-down': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  'chevron-right': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  info: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,
  monitor: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
}

function Icon({ name, className }: { name: string; className?: string }) {
  const svg = SVG_ICONS[name]
  if (!svg) return null
  return <span className={`prot-icon ${className ?? ''}`}>{svg}</span>
}

// ─── Live status helpers ──────────────────────────────────────────────────────

interface LiveStatuses {
  dns: { status: string; tone: Tone }
  hosts: { status: string; tone: Tone }
  dnr: { status: string; tone: Tone }
  worker: { status: string; tone: Tone }
  scan: { status: string; tone: Tone }
  lock: { status: string; tone: Tone }
  bridge: { status: string; tone: Tone }
}

function useLiveStatuses(): LiveStatuses {
  const { status: ext } = useExtensionStatus()
  const { status: lock } = useBlockingLock()
  const { status: hosts } = useHostsBlocking()

  const extConnected = ext?.connected ?? false
  const extTone: Tone = extConnected ? 'mint' : 'amber'
  const extLabel = extConnected ? 'Reported active' : 'Extension offline'

  let lockStatus = 'No lock set'
  let lockTone: Tone = 'amber'
  if (lock?.hasLock) {
    lockStatus = lock.lockKind === 'password' ? 'Password set' : 'Friction challenge'
    lockTone = 'mint'
  }

  let hostsLabel = 'Unknown'
  let hostsTone: Tone = 'muted'
  if (hosts) {
    if (hosts.enabled) {
      hostsLabel = `Active · ${hosts.appliedDomainCount.toLocaleString()} domains`
      hostsTone = 'mint'
    } else {
      hostsLabel = 'Disabled'
      hostsTone = 'amber'
    }
  }

  return {
    dns: { status: 'External / planned', tone: 'muted' },
    hosts: { status: hostsLabel, tone: hostsTone },
    dnr: { status: extLabel, tone: extTone },
    worker: { status: extLabel, tone: extTone },
    scan: { status: extConnected ? 'Reported active' : 'Extension offline', tone: extTone },
    lock: { status: lockStatus, tone: lockTone },
    bridge: { status: extConnected ? 'Connected' : 'Offline', tone: extConnected ? 'mint' : 'amber' },
  }
}

// ─── Orb scene (user view) ───────────────────────────────────────────────────

function OrbScene({ story }: { story: string }) {
  return (
    <div className="prot-orb-scene" data-story={story} aria-hidden="true">
      <div className="prot-orb-grid" />
      <div className="prot-orbit prot-orbit-wide" />
      <div className="prot-orbit prot-orbit-mid" />
      <div className="prot-orbit prot-orbit-close" />
      <div className="prot-orb-core">
        <Icon name="shield-check" />
      </div>
      <span className="prot-spark prot-spark-one" />
      <span className="prot-spark prot-spark-two" />
      <span className="prot-spark prot-spark-three" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProtectionLayersView() {
  const liveStatuses = useLiveStatuses()
  const [view, setView] = useState<'developer' | 'everyday'>('developer')
  const [selectedLayer, setSelectedLayer] = useState<string>('dnr')
  const [scenario, setScenario] = useState<string>('known')
  const [stepIndex, setStepIndex] = useState(0)
  const [playState, setPlayState] = useState<'idle' | 'playing' | 'paused'>('idle')
  const [gapOpen, setGapOpen] = useState(false)
  const [story, setStory] = useState<string>('known')
  const [simulationEvents, setSimulationEvents] = useState<Map<string, { result: string; tone: Tone }>>(new Map())
  const [resultMsg, setResultMsg] = useState({ title: 'Ready to simulate', copy: 'Run the scenario or inspect any layer below.', tone: 'muted' as Tone })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset when scenario changes
  useEffect(() => {
    resetSimulation()
  }, [scenario])

  // Clean up on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  function resetSimulation() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setPlayState('idle')
    setStepIndex(0)
    setSimulationEvents(new Map())
    setResultMsg({ title: 'Ready to simulate', copy: 'Run the scenario or inspect any layer below.', tone: 'muted' })
  }

  function doStep(currentIndex: number, currentEvents: Map<string, { result: string; tone: Tone }>): boolean {
    const sc = SCENARIOS[scenario]
    if (currentIndex >= sc.steps.length) return false
    const [key, result, tone, detail] = sc.steps[currentIndex]
    const next = new Map(currentEvents)
    next.set(key, { result, tone })
    setSimulationEvents(next)
    setSelectedLayer(key)
    const done = currentIndex + 1 === sc.steps.length
    if (done) {
      setResultMsg({ title: sc.title, copy: sc.copy, tone: sc.tone })
    } else {
      setResultMsg({ title: `Step ${currentIndex + 1} of ${sc.steps.length} · ${LAYER_DEFS[key].title}`, copy: result, tone })
    }
    // Store the detail text for the event box by updating the events map with the detail
    // We use a separate approach: pass detail through selected layer's event
    _pendingEventDetail.current = { key, detail }
    return !done
  }

  const _pendingEventDetail = useRef<{ key: string; detail: string } | null>(null)
  const [layerEventDetail, setLayerEventDetail] = useState<string | null>(null)

  function stepOnce() {
    const sc = SCENARIOS[scenario]
    if (stepIndex >= sc.steps.length) {
      // replay
      resetSimulation()
      return
    }
    const hasMore = doStep(stepIndex, simulationEvents)
    if (_pendingEventDetail.current?.key === sc.steps[stepIndex]?.[0]) {
      setLayerEventDetail(_pendingEventDetail.current.detail)
    }
    setStepIndex(stepIndex + 1)
    if (!hasMore) setPlayState('idle')
  }

  function autoplay(currentIndex: number, events: Map<string, { result: string; tone: Tone }>) {
    const sc = SCENARIOS[scenario]
    if (currentIndex >= sc.steps.length) {
      setPlayState('idle')
      return
    }
    const hasMore = doStep(currentIndex, events)
    const nextEvents = new Map(events)
    const [key, result, tone] = sc.steps[currentIndex]
    nextEvents.set(key, { result, tone })
    if (_pendingEventDetail.current) {
      setLayerEventDetail(_pendingEventDetail.current.detail)
    }
    setStepIndex(currentIndex + 1)
    if (hasMore) {
      timerRef.current = setTimeout(() => autoplay(currentIndex + 1, nextEvents), 490)
    } else {
      setPlayState('idle')
    }
  }

  function handleRunPause() {
    if (playState === 'playing') {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      setPlayState('paused')
      return
    }
    if (stepIndex >= SCENARIOS[scenario].steps.length) {
      resetSimulation()
      setTimeout(() => {
        setPlayState('playing')
        autoplay(0, new Map())
      }, 0)
      return
    }
    setPlayState('playing')
    autoplay(stepIndex, simulationEvents)
  }

  // Clear event detail when selected layer changes manually
  function selectLayer(key: string) {
    setSelectedLayer(key)
    setLayerEventDetail(null)
  }

  // Determine the status pill for a given layer key (live + simulation override)
  function getLayerBadge(key: string): { label: string; tone: Tone } {
    const sim = simulationEvents.get(key)
    if (sim) return { label: sim.result, tone: sim.tone }
    const live = liveStatuses[key as keyof typeof liveStatuses]
    return { label: live.status, tone: live.tone }
  }

  const inspected = LAYER_DEFS[selectedLayer]
  const inspectedBadge = getLayerBadge(selectedLayer)
  const currentStory = STORIES[story]

  return (
    <div className="prot-view">
      {/* Page header */}
      <header className="prot-page-header">
        <div className="prot-page-title">
          <Icon name="shield-check" className="prot-page-icon" />
          <span>Boundaries</span>
          <span className="prot-crumb-sep">/</span>
          <h1>Protection layers</h1>
        </div>
        <div className="prot-view-switch" role="group" aria-label="Protection view">
          <button
            type="button"
            className={`prot-switch-btn ${view === 'developer' ? 'prot-switch-btn--active' : ''}`}
            aria-pressed={view === 'developer'}
            onClick={() => setView('developer')}
          >
            Developer
          </button>
          <button
            type="button"
            className={`prot-switch-btn ${view === 'everyday' ? 'prot-switch-btn--active' : ''}`}
            aria-pressed={view === 'everyday'}
            onClick={() => setView('everyday')}
          >
            User view
          </button>
        </div>
      </header>

      {/* ── DEVELOPER VIEW ── */}
      {view === 'developer' && (
        <section className="prot-developer" aria-label="Developer view">
          {/* Simulator workbench */}
          <div className="prot-workbench">
            <div className="prot-simulator">
              <div className="prot-simulator-title">
                <div className="prot-terminal">
                  <Icon name="terminal" />
                </div>
                <div>
                  <strong>Request simulator</strong>
                  <small>Based on your current configuration</small>
                </div>
              </div>
              <div className="prot-sim-controls">
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  aria-label="Simulation scenario"
                >
                  <option value="known">Known domain · DNR</option>
                  <option value="custom">Custom rule · Focus active</option>
                  <option value="scan">Unlisted page · Strong signals</option>
                  <option value="miss">Unlisted page · Weak signals</option>
                  <option value="offline">Native host offline · Local match</option>
                  <option value="hosts">Hosts file · Enabled example</option>
                  <option value="pause">Attempt to pause protection</option>
                  <option value="remove">Attempt to remove extension</option>
                </select>
                <button
                  type="button"
                  className="prot-step-btn"
                  onClick={stepOnce}
                  disabled={playState === 'playing'}
                >
                  Step
                </button>
                <button
                  type="button"
                  className="prot-run-btn"
                  onClick={handleRunPause}
                >
                  {playState === 'playing' ? (
                    <><Icon name="pause" /> <span>Pause</span></>
                  ) : stepIndex >= SCENARIOS[scenario].steps.length ? (
                    <><Icon name="rotate-ccw" /> <span>Replay</span></>
                  ) : (
                    <><Icon name="play" /> <span>Run</span></>
                  )}
                </button>
              </div>
            </div>
            <div className={`prot-result prot-result--${resultMsg.tone}`} role="status" aria-live="polite">
              <span className="prot-result-mark" aria-hidden="true" />
              <div>
                <strong>{resultMsg.title}</strong>
                <span> {resultMsg.copy}</span>
              </div>
            </div>
          </div>

          {/* Section label */}
          <div className="prot-section-label">
            <h2>Request path</h2>
            <span>Logical flow · Chrome checks can overlap</span>
          </div>

          {/* Layer map + inspector */}
          <div className="prot-grid">
            {/* Left: layer map */}
            <div className="prot-map" aria-label="Protection layer map">
              <div className="prot-map-body">
                {/* Phase: OS & Network */}
                <div className="prot-phase">
                  <span className="prot-phase-node" aria-hidden="true" />
                  <p>OS &amp; NETWORK</p>
                  {(['dns', 'hosts'] as const).map((key, i) => {
                    const def = LAYER_DEFS[key]
                    const badge = getLayerBadge(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`prot-layer ${selectedLayer === key ? 'prot-layer--active' : ''}`}
                        aria-pressed={selectedLayer === key}
                        onClick={() => selectLayer(key)}
                      >
                        <span className="prot-numeral">0{i + 1}</span>
                        <span className="prot-layer-icon"><Icon name={def.icon} /></span>
                        <span className="prot-layer-label">
                          {def.title}
                          <small>{key === 'dns' ? 'External or planned' : 'Device-level domain mapping'}</small>
                        </span>
                        <span className={`prot-state prot-state--${badge.tone}`}>{badge.label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Phase: Chrome Navigation */}
                <div className="prot-phase">
                  <span className="prot-phase-node" aria-hidden="true" />
                  <p>CHROME NAVIGATION</p>
                  {(['dnr', 'worker'] as const).map((key, i) => {
                    const def = LAYER_DEFS[key]
                    const badge = getLayerBadge(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`prot-layer ${selectedLayer === key ? 'prot-layer--active' : ''}`}
                        aria-pressed={selectedLayer === key}
                        onClick={() => selectLayer(key)}
                      >
                        <span className="prot-numeral">0{i + 3}</span>
                        <span className="prot-layer-icon"><Icon name={def.icon} /></span>
                        <span className="prot-layer-label">
                          {def.title}
                          <small>{key === 'dnr' ? 'Before the request' : 'Service worker'}</small>
                        </span>
                        <span className={`prot-state prot-state--${badge.tone}`}>{badge.label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Phase: Page Content */}
                <div className="prot-phase">
                  <span className="prot-phase-node" aria-hidden="true" />
                  <p>PAGE CONTENT</p>
                  <button
                    type="button"
                    className={`prot-layer ${selectedLayer === 'scan' ? 'prot-layer--active' : ''}`}
                    aria-pressed={selectedLayer === 'scan'}
                    onClick={() => selectLayer('scan')}
                  >
                    <span className="prot-numeral">05</span>
                    <span className="prot-layer-icon"><Icon name="scan-text" /></span>
                    <span className="prot-layer-label">
                      {LAYER_DEFS.scan.title}
                      <small>After the DOM is ready</small>
                    </span>
                    <span className={`prot-state prot-state--${getLayerBadge('scan').tone}`}>{getLayerBadge('scan').label}</span>
                  </button>
                </div>
              </div>

              {/* Support layers */}
              <div className="prot-support">
                <p>PROTECTION CONTROLS &amp; DEPENDENCIES</p>
                <button
                  type="button"
                  className={`prot-layer ${selectedLayer === 'lock' ? 'prot-layer--active' : ''}`}
                  aria-pressed={selectedLayer === 'lock'}
                  onClick={() => selectLayer('lock')}
                >
                  <span className="prot-numeral">06</span>
                  <span className="prot-layer-icon"><Icon name="lock-keyhole" /></span>
                  <span className="prot-layer-label">
                    Anti-disable
                    <small>Pause, rule changes &amp; removal</small>
                  </span>
                  <span className={`prot-state prot-state--${getLayerBadge('lock').tone}`}>{getLayerBadge('lock').label}</span>
                </button>
                <button
                  type="button"
                  className={`prot-layer ${selectedLayer === 'bridge' ? 'prot-layer--active' : ''}`}
                  aria-pressed={selectedLayer === 'bridge'}
                  onClick={() => selectLayer('bridge')}
                >
                  <span className="prot-numeral prot-numeral--sym">↔</span>
                  <span className="prot-layer-icon"><Icon name="cable" /></span>
                  <span className="prot-layer-label">
                    Native bridge
                    <small>Desktop rules &amp; heartbeat</small>
                  </span>
                  <span className={`prot-state prot-state--${getLayerBadge('bridge').tone}`}>{getLayerBadge('bridge').label}</span>
                </button>
              </div>
            </div>

            {/* Right: inspector */}
            <article className="prot-inspector" aria-label="Selected layer">
              <div className="prot-inspector-header">
                <span className="prot-inspector-symbol">
                  <Icon name={inspected.icon} />
                </span>
                <span className={`prot-state prot-state--${inspectedBadge.tone}`}>{inspectedBadge.label}</span>
              </div>
              <div className="prot-inspector-title">
                <div className="prot-kicker">{inspected.tag}</div>
                <h3>{inspected.title}</h3>
                <p>{inspected.lead}</p>
              </div>
              <div className="prot-facts">
                <div>
                  <h4>How it works</h4>
                  <p>{inspected.action}</p>
                </div>
                <div>
                  <h4>Where it can miss</h4>
                  <p>{inspected.limit}</p>
                </div>
                <div>
                  <h4>Implementation</h4>
                  <div className="prot-code">
                    {inspected.code.map((c) => <code key={c}>{c}</code>)}
                  </div>
                </div>
              </div>
              {layerEventDetail && (
                <div className="prot-layer-event">
                  <span>IN THIS SIMULATION</span>
                  <p>{layerEventDetail}</p>
                </div>
              )}
            </article>
          </div>

          {/* Coverage gaps */}
          <details className="prot-gap" open={gapOpen} onToggle={(e) => setGapOpen((e.target as HTMLDetailsElement).open)}>
            <summary>
              <span>
                <Icon name="shield-alert" /> Coverage gaps &amp; next checks
              </span>
              <Icon name="chevron-down" className={gapOpen ? 'prot-chevron-open' : ''} />
            </summary>
            <div className="prot-gap-body">
              <div>
                <h4>Verify the build and rules</h4>
                <p>Check the extension, reload <code>dist</code> for page-scan fixes, confirm hosts and policy settings, and verify imported rules and regex handling (including 12003).</p>
              </div>
              <div>
                <h4>Harden removal resistance</h4>
                <p>Test the planned <code>--hardcore</code> restrictions and managed CRX force-install against the unpacked extension's current removal path.</p>
              </div>
              <div>
                <h4>Extend device coverage</h4>
                <p>Confirm what Cold Turkey covers on this machine. Clarity DNS is planned but not yet built in.</p>
              </div>
            </div>
          </details>
        </section>
      )}

      {/* ── USER / EVERYDAY VIEW ── */}
      {view === 'everyday' && (
        <section className="prot-everyday" aria-label="User view">
          <div className="prot-user-hero">
            <div className="prot-user-copy">
              <h2>How Clarity keeps your boundaries in place</h2>
              <p>Clarity checks the site address and can look at the page itself. A pause challenge gives you a moment to reconsider before turning protection off.</p>
              <div className="prot-user-choices" role="group" aria-label="Explore everyday examples">
                {(['known', 'unknown', 'pause'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`prot-choice-btn ${story === key ? 'prot-choice-btn--active' : ''}`}
                    aria-pressed={story === key}
                    onClick={() => setStory(key)}
                  >
                    {key === 'known' ? 'Known site' : key === 'unknown' ? 'New site' : 'Pause protection'}
                  </button>
                ))}
              </div>
            </div>
            <OrbScene story={story} />
          </div>

          <article className="prot-story" aria-live="polite">
            <div className="prot-story-top">
              <span className="prot-inspector-symbol">
                <Icon name={currentStory.icon} />
              </span>
              <div>
                <p className="prot-kicker">{currentStory.when}</p>
                <h3>{currentStory.title}</h3>
              </div>
            </div>
            <p>{currentStory.copy}</p>
            <div className="prot-story-path" aria-label="Example steps">
              {currentStory.path.map((label, i) => (
                <span key={i} className="prot-story-step-wrap">
                  {i > 0 && <Icon name="chevron-right" className="prot-story-arrow" />}
                  <span className="prot-story-step">{label}</span>
                </span>
              ))}
            </div>
            <div className="prot-story-note">
              <Icon name="info" />
              <span>{currentStory.note}</span>
            </div>
          </article>

          <div className="prot-user-scope">
            <Icon name="monitor" />
            <span>Website checks shown here apply in Chrome with the Clarity extension enabled. Device-wide protection depends on your setup.</span>
          </div>
        </section>
      )}
    </div>
  )
}
