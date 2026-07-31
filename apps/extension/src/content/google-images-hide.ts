/**
 * Google Images — instant-hide "See more" / related images in the preview panel.
 *
 * After opening a thumbnail, Google shows a related-images rail that enables
 * endless browsing. We hide that affordance with CSS + MutationObserver.
 * Scoped to Images contexts only (tbm=isch / udm=2 / imghp / imgres).
 */

const HIDE_ATTR = 'data-clarity-hide-gi-related'
const STYLE_ID = 'clarity-gi-related-hide'

/** Exact or near-exact labels for the related / see-more section (EN/FR/JA/KO). */
const RELATED_LABEL_RE =
  /^(see more(\s+images)?|related images?|visually similar(\s+images?)?|more images|images? similaires|voir plus|afficher plus|visuellement similaires|images associ[eé]es|関連画像|似ている画像|もっと見る|비슷한 이미지|관련 이미지|더 보기|더보기)$/i
const CSS = `
/* Classic immersive related-images rail */
.irc_ris,
#irc_ris,
div.irc_rit,
.irc_rismo {
  display: none !important;
}

/* Marked by Clarity DOM walker */
[${HIDE_ATTR}] {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  max-height: 0 !important;
  overflow: hidden !important;
  margin: 0 !important;
  padding: 0 !important;
  pointer-events: none !important;
}
`

function log(...args: unknown[]): void {
  console.log(`[Clarity ${new Date().toISOString()}]`, ...args)
}

function isGoogleHost(): boolean {
  return /(^|\.)google\./i.test(location.hostname)
}

export function isGoogleImagesContext(): boolean {
  if (!isGoogleHost()) return false
  const { pathname, search } = location
  if (pathname.includes('/imghp') || pathname.includes('/imgres')) return true
  const params = new URLSearchParams(search)
  return params.get('tbm') === 'isch' || params.get('udm') === '2'
}

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  const parent = document.head || document.documentElement
  parent.appendChild(style)
}

function markHidden(el: Element): void {
  if (el.hasAttribute(HIDE_ATTR)) return
  el.setAttribute(HIDE_ATTR, '1')
}

function isChromeUi(el: Element): boolean {
  return Boolean(el.closest('#searchform, form[role="search"], header, [role="banner"], nav'))
}

function isMainResultsRoot(el: Element): boolean {
  const id = el.id
  return id === 'rso' || id === 'search' || id === 'center_col' || id === 'rcnt' || id === 'main'
}

/**
 * Walk up from a "See more" / "Related images" label to the section that
 * holds the related thumbnail grid — without swallowing the main results.
 */
function findSectionRoot(labelEl: Element): Element | null {
  const known = labelEl.closest('.irc_ris, #irc_ris, div.irc_rit')
  if (known) return known

  let best: Element | null = null
  let node: Element | null = labelEl.parentElement

  for (let depth = 0; depth < 10 && node; depth++) {
    if (isMainResultsRoot(node) || node === document.body || node === document.documentElement) {
      break
    }

    const imgCount = node.querySelectorAll('img').length
    if (imgCount >= 3 && imgCount <= 120) {
      best = node
    } else if (imgCount > 120) {
      break
    }

    node = node.parentElement
  }

  return best ?? labelEl.parentElement
}

function labelText(el: Element): string {
  const aria = el.getAttribute('aria-label')
  if (aria) return aria.trim()
  // Prefer leaf-ish text; skip huge containers
  const text = (el as HTMLElement).innerText ?? el.textContent ?? ''
  return text.trim()
}

function hideMatchingLabels(root: ParentNode): void {
  const candidates = root.querySelectorAll(
    'h1, h2, h3, h4, h5, [role="heading"], span, div, a, button, [aria-label]'
  )

  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i]
    if (el.closest(`[${HIDE_ATTR}]`)) continue
    if (isChromeUi(el)) continue

    const text = labelText(el)
    if (!text || text.length > 48) continue
    if (!RELATED_LABEL_RE.test(text)) continue

    // Avoid matching a giant wrapper whose innerText happens to include the label
    if (el.querySelectorAll('img').length > 120) continue

    const section = findSectionRoot(el)
    if (section && !isMainResultsRoot(section) && !isChromeUi(section)) {
      markHidden(section)
    } else {
      markHidden(el)
    }
  }
}

function hideKnownContainers(root: ParentNode): void {
  const nodes = root.querySelectorAll('.irc_ris, #irc_ris, div.irc_rit, .irc_rismo')
  for (let i = 0; i < nodes.length; i++) markHidden(nodes[i])
}

function sweep(root: ParentNode = document): void {
  if (!isGoogleImagesContext()) return
  hideKnownContainers(root)
  hideMatchingLabels(root)
}

function hideAddedNode(node: Element): void {
  if (node.matches?.('.irc_ris, #irc_ris, div.irc_rit, .irc_rismo')) {
    markHidden(node)
  }
  const nested = node.querySelectorAll?.('.irc_ris, #irc_ris, div.irc_rit, .irc_rismo')
  if (nested) {
    for (let i = 0; i < nested.length; i++) markHidden(nested[i])
  }
}

let started = false

/**
 * Start Google Images related-rail hiding. Safe to call on any page — no-ops off Google.
 */
export function initGoogleImagesHide(): void {
  if (!isGoogleHost() || started) return
  started = true

  injectStyle()
  if (isGoogleImagesContext()) {
    sweep()
  }

  let scheduled = false
  const scheduleSweep = (): void => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      if (isGoogleImagesContext()) sweep()
    })
  }

  const observer = new MutationObserver((mutations) => {
    if (!isGoogleImagesContext()) return

    for (let mi = 0; mi < mutations.length; mi++) {
      const added = mutations[mi].addedNodes
      for (let ni = 0; ni < added.length; ni++) {
        const node = added[ni]
        if (node instanceof Element) hideAddedNode(node)
      }
    }
    scheduleSweep()
  })

  const observeRoot = (): void => {
    observer.observe(document.documentElement, { childList: true, subtree: true })
    if (isGoogleImagesContext()) sweep()
  }

  if (document.documentElement) {
    observeRoot()
  } else {
    document.addEventListener('DOMContentLoaded', observeRoot, { once: true })
  }

  // Soft navigations between Web ↔ Images
  let lastHref = location.href
  setInterval(() => {
    if (location.href === lastHref) return
    lastHref = location.href
    if (!isGoogleImagesContext()) return
    injectStyle()
    sweep()
  }, 800)

  log('[GoogleImagesHide] watching for related / See more UI')
}
