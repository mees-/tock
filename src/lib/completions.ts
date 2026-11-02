export type Suggestion = {
  insert: string
  detail?: string
  /** Keep the popup open after accepting, for a follow-up completion. */
  chain?: boolean
}

/** Suggestions replacing `value.slice(from, to)`. */
export type CompletionResult = { from: number; to: number; items: Suggestion[] }

export type CompletionProvider = (
  value: string,
  caret: number,
) => CompletionResult | null

const MAX_ITEMS = 8

function byPrefix(items: Suggestion[], typed: string) {
  const query = typed.toLowerCase()
  return items
    .filter(item => item.insert.toLowerCase().startsWith(query))
    .slice(0, MAX_ITEMS)
}

export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const

export const completeMethod: CompletionProvider = value => ({
  from: 0,
  to: value.length,
  items: byPrefix(
    HTTP_METHODS.map(m => ({ insert: m })),
    value,
  ),
})

const HEADER_NAMES = [
  "Accept",
  "Accept-Encoding",
  "Accept-Language",
  "Authorization",
  "Cache-Control",
  "Content-Type",
  "Cookie",
  "If-Match",
  "If-None-Match",
  "Origin",
  "Referer",
  "User-Agent",
  "X-Api-Key",
  "X-Request-Id",
]

const MEDIA_TYPES = [
  "application/json",
  "application/x-www-form-urlencoded",
  "text/plain",
  "text/html",
  "*/*",
]

const HEADER_VALUES: Record<string, string[]> = {
  accept: MEDIA_TYPES,
  "content-type": MEDIA_TYPES,
  "accept-encoding": ["gzip, deflate, br", "identity"],
  "accept-language": ["en-US,en;q=0.9"],
  authorization: ["Bearer ", "Basic "],
  "cache-control": ["no-cache", "no-store", "max-age=0"],
  "user-agent": ["tock"],
}

export const completeHeader: CompletionProvider = (value, caret) => {
  const colon = value.indexOf(":")
  if (colon === -1) {
    return {
      from: 0,
      to: value.length,
      items: byPrefix(
        HEADER_NAMES.map(name => ({ insert: `${name}: `, chain: true })),
        value.slice(0, caret),
      ),
    }
  }
  if (caret <= colon) {
    return {
      from: 0,
      to: colon,
      items: byPrefix(
        HEADER_NAMES.map(name => ({ insert: name })),
        value.slice(0, caret),
      ),
    }
  }
  const values = HEADER_VALUES[value.slice(0, colon).trim().toLowerCase()]
  if (values == null) return null
  const from = colon + 1 + (/^ */.exec(value.slice(colon + 1))?.[0].length ?? 0)
  return {
    from,
    to: value.length,
    items: byPrefix(
      values.map(v => ({ insert: v })),
      value.slice(from, caret),
    ),
  }
}

const CRON_PRESETS: Suggestion[] = [
  { insert: "* * * * *", detail: "every minute" },
  { insert: "*/5 * * * *", detail: "every 5 minutes" },
  { insert: "*/15 * * * *", detail: "every 15 minutes" },
  { insert: "0 * * * *", detail: "every hour" },
  { insert: "0 */6 * * *", detail: "every 6 hours" },
  { insert: "0 0 * * *", detail: "every day at midnight" },
  { insert: "0 9 * * *", detail: "every day at 09:00" },
  { insert: "0 9 * * 1-5", detail: "weekdays at 09:00" },
  { insert: "0 0 * * 0", detail: "every Sunday at midnight" },
  { insert: "0 0 1 * *", detail: "first of the month" },
]

/** Matches presets by expression prefix or by words in their description. */
export const completeCron: CompletionProvider = value => {
  const query = value.trim().toLowerCase()
  const items = CRON_PRESETS.filter(
    preset =>
      preset.insert.startsWith(value) ||
      (query !== "" && /[a-z]/.test(query) && preset.detail?.includes(query)),
  )
  return { from: 0, to: value.length, items: items.slice(0, MAX_ITEMS) }
}
