/**
 * Suggest groups — cheap gpt-4o-mini call using titles + hostnames only.
 *
 * Privacy: only { tabId, title, hostname } leave the device — never page content.
 *
 * Limitation: Custom groups remember hosts. Same-host tabs split across themes
 * (e.g. multiple chatgpt.com chats) cannot all be encoded as domain rules; we
 * still organize the current tabs by tabId when applying Chrome groups.
 */

import { hostnameOf } from './grouping'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'

/** Cap payload size to keep cost/latency low. */
export const SUGGEST_GROUPS_TAB_CAP = 50

export interface SuggestTabInput {
  tabId: number
  title: string
  hostname: string
}

export interface SuggestedGroup {
  title: string
  tabIds: number[]
}

export interface SuggestGroupsResult {
  groups: SuggestedGroup[]
  /** Tabs not assigned to any named group */
  ungroupedTabIds: number[]
  truncated: boolean
}

export class SuggestGroupsError extends Error {
  constructor(
    message: string,
    readonly code: 'NO_API_KEY' | 'HTTP' | 'PARSE' | 'EMPTY'
  ) {
    super(message)
    this.name = 'SuggestGroupsError'
  }
}

export function tabsToSuggestInput(
  tabs: { id: number; title: string; url: string }[],
  cap = SUGGEST_GROUPS_TAB_CAP
): { inputs: SuggestTabInput[]; truncated: boolean } {
  const sliced = tabs.slice(0, cap)
  return {
    truncated: tabs.length > cap,
    inputs: sliced.map((t) => ({
      tabId: t.id,
      title: (t.title || 'Untitled').slice(0, 120),
      hostname: hostnameOf(t.url),
    })),
  }
}

/**
 * Light local seeding: repeated title prefixes before " - " / " | " / ":".
 * Only returns clean seeds that appear on 2+ tabs — skips noisy one-offs.
 */
export function extractSeedThemes(tabs: SuggestTabInput[]): string[] {
  const counts = new Map<string, number>()

  for (const t of tabs) {
    const title = t.title.trim()
    const match = title.match(/^([A-Za-z][\w /&.'+]{0,28}?)\s*[-–|:]\s+\S/)
    if (!match) continue
    const seed = match[1]!.replace(/\s+/g, ' ').trim()
    if (seed.length < 2 || seed.length > 28) continue
    // Skip generic / tool-ish prefixes
    if (/^(chat|chatgpt|claude|gemini|ai|new|untitled|https?)$/i.test(seed)) continue
    counts.set(seed, (counts.get(seed) ?? 0) + 1)
  }

  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([seed]) => seed)
}

const SYSTEM_PROMPT = `You organize open browser tabs into thematic / intent-based groups.
Respond ONLY with valid JSON: {"groups":[{"title":"...","tabIds":[...]}]}.
Never invent tabIds. Never group by product/tool/site alone when titles show different topics.`

function buildPrompt(tabs: SuggestTabInput[], seeds: string[]): string {
  const list = tabs
    .map((t) => `- tabId: ${t.tabId} | host: ${t.hostname} | title: "${t.title.replace(/"/g, "'")}"`)
    .join('\n')

  const seedBlock =
    seeds.length > 0
      ? `\nSuggested seed themes from title prefixes (use when they fit; rename to be clearer if needed): ${seeds.map((s) => `"${s}"`).join(', ')}\n`
      : ''

  return `You organize open browser tabs into meaningful thematic groups for a workspace board.

Tabs (titles and hostnames only — no page content):
${list}
${seedBlock}
Core rules:
1. Theme / intent first — NEVER tool or site first. Do NOT dump all chatgpt.com (or pinterest.com, etc.) tabs into one group like "AI Chats", "ChatGPT", or "Pinterest". Read each title and group by what the person is working on.
2. Same host ≠ same group. If several tabs share a hostname but titles indicate different topics, you MUST split them. Example: ChatGPT tabs titled "OL Architecture review", "Japan wedding visa legal", and "Pocket WiFi options" → three groups such as "OL Architecture", "Japan legal", "Pocket WiFi" — not one "AI Chats".
3. Cross-site theme clustering. Prefer grouping by shared intent across domains (e.g. a visa.gov page + ChatGPT "Legal Japan" + a related Google Doc → one "Japan legal" / "Japan admin" group) over leaving related tabs Ungrouped or splitting by site.
4. Group size: prefer smaller precise groups of ~2–5 tabs. Split rather than create catch-alls. Singleton groups are OK when a title is clearly a distinct project.
5. Ban vague / generic labels when titles allow something specific. Avoid or strongly discourage: "AI Chats", "ChatGPT", "Browsing", "Misc", "Other", "Project Management", "Work", "Personal", "Research", "Tools", "Shopping" (unless titles truly are generic shopping). Prefer concrete themes: "Japan legal", "OL Architecture", "Travel / trip", "Pocket WiFi", "Investment notes".
6. Titles: short human labels, typically 2–4 words, specific to the theme.
7. Assign each tabId to at most one group. Use only tabIds from the list above.
8. Put true leftovers in an "Ungrouped" group (or omit them). Prefer moving a tab into a thematic group over Ungrouped when a clear theme exists.
9. Propose as many groups as the themes warrant (roughly 2–12); precision beats fewer catch-all buckets.

Respond ONLY with valid JSON:
{"groups":[{"title":"Japan legal","tabIds":[1,2]},{"title":"OL Architecture","tabIds":[3]},{"title":"Ungrouped","tabIds":[4]}]}`
}

function parseResponse(content: string, validIds: Set<number>): SuggestGroupsResult | null {
  try {
    const parsed = JSON.parse(content) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const rawGroups = (parsed as { groups?: unknown }).groups
    if (!Array.isArray(rawGroups)) return null

    const assigned = new Set<number>()
    const groups: SuggestedGroup[] = []
    let ungroupedTabIds: number[] = []

    for (const raw of rawGroups) {
      if (!raw || typeof raw !== 'object') continue
      const title = String((raw as { title?: unknown }).title ?? '')
        .trim()
        .slice(0, 40)
      const tabIdsRaw = (raw as { tabIds?: unknown }).tabIds
      if (!title || !Array.isArray(tabIdsRaw)) continue

      const tabIds = tabIdsRaw
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && validIds.has(id) && !assigned.has(id))

      for (const id of tabIds) assigned.add(id)

      if (/^ungrouped$/i.test(title)) {
        ungroupedTabIds = [...ungroupedTabIds, ...tabIds]
        continue
      }

      if (tabIds.length === 0) continue
      groups.push({ title, tabIds })
    }

    for (const id of validIds) {
      if (!assigned.has(id)) ungroupedTabIds.push(id)
    }

    return { groups, ungroupedTabIds, truncated: false }
  } catch {
    return null
  }
}

/**
 * Call OpenAI with titles/hostnames only. Caller supplies apiKey from storage.
 */
export async function suggestGroups(
  tabs: SuggestTabInput[],
  apiKey: string
): Promise<SuggestGroupsResult> {
  const key = apiKey.trim()
  if (!key) throw new SuggestGroupsError('Add an OpenAI API key first.', 'NO_API_KEY')
  if (tabs.length === 0) throw new SuggestGroupsError('No tabs to suggest groups for.', 'EMPTY')

  const validIds = new Set(tabs.map((t) => t.tabId))
  const seeds = extractSeedThemes(tabs)

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(tabs, seeds) },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.warn('[Tab Manager] suggest groups OpenAI error', response.status, body)
    if (response.status === 401) {
      throw new SuggestGroupsError('OpenAI API key rejected. Check the key in settings.', 'HTTP')
    }
    throw new SuggestGroupsError('Could not get suggestions. Try again.', 'HTTP')
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new SuggestGroupsError('Unexpected response from AI.', 'PARSE')
  }

  const result = parseResponse(content, validIds)
  if (!result) {
    throw new SuggestGroupsError('Could not parse AI suggestions.', 'PARSE')
  }
  if (result.groups.length === 0 && result.ungroupedTabIds.length === 0) {
    throw new SuggestGroupsError('AI returned no groups.', 'EMPTY')
  }

  return result
}
