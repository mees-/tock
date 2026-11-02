export type JsonTokenKind =
  "key" | "string" | "number" | "literal" | "punct" | "space" | "other"

export type JsonToken = { text: string; kind: JsonTokenKind; offset: number }

export type JsonProblem = { message: string; offset: number }

const TOKEN =
  /("(?:\\.|[^"\\\n])*"?)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(true|false|null)\b|([{}[\],:])|(\s+)|(.)/gy
const KEY_SUFFIX = /^\s*:/
const JSON_INDENT = 2

export function looksLikeJson(text: string) {
  const first = text.trimStart()[0]
  return first === "{" || first === "["
}

export function tokenizeJson(text: string): JsonToken[] {
  const tokens: JsonToken[] = []
  TOKEN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TOKEN.exec(text)) != null) {
    const [whole, str, num, literal, punct, space] = match
    const offset = match.index
    let kind: JsonTokenKind = "other"
    if (str != null) {
      const rest = text.slice(offset + whole.length)
      kind = KEY_SUFFIX.test(rest) ? "key" : "string"
    } else if (num != null) kind = "number"
    else if (literal != null) kind = "literal"
    else if (punct != null) kind = "punct"
    else if (space != null) kind = "space"
    tokens.push({ text: whole, kind, offset })
  }
  return tokens
}

/** Parse error with an offset, for text that is meant to be JSON. */
export function jsonProblem(text: string): JsonProblem | null {
  if (!looksLikeJson(text)) return null
  try {
    JSON.parse(text)
    return null
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    return { message: cleanMessage(raw), offset: errorOffset(raw, text) }
  }
}

function errorOffset(message: string, text: string) {
  const position = /position (\d+)/.exec(message)
  if (position != null) return Number(position[1])
  const lineColumn = /line (\d+) column (\d+)/.exec(message)
  if (lineColumn != null) {
    const lines = text.split("\n").slice(0, Number(lineColumn[1]) - 1)
    const lineStart = lines.reduce((sum, line) => sum + line.length + 1, 0)
    return lineStart + Number(lineColumn[2]) - 1
  }
  return text.length
}

function cleanMessage(message: string) {
  return message
    .replace(/^JSON(\.parse| Parse error):\s*/i, "")
    .replace(/\s*(in JSON )?at (position|line) .*$/, "")
    .replace(/ of the JSON data$/, "")
}

/** Pretty-printed JSON, or null when the text doesn't parse. */
export function formatJson(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, JSON_INDENT)
  } catch {
    return null
  }
}
