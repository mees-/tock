export const isMacOs = globalThis.navigator.userAgent.includes("Mac")

/** Shortcut label for the current platform, e.g. `⌘S` or `Ctrl+S`. */
export function shortcut(mac: string, other: string) {
  return isMacOs ? mac : other
}
