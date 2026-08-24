import { withBasePath } from "./base-path"
import { detectResourceType } from "./resource-utils"
import type { ResourceType } from "./types"

export interface ScrapeResult {
  title: string
  author: string
  summary: string
  thumbnail: string
  suggestedTags: string[]
  type?: ResourceType
  year?: number
  duration?: string
  /** True when at least one field could be auto-filled. */
  found: boolean
}

const SCRAPE_ENDPOINT = "/scrape.php"
const REQUEST_TIMEOUT_MS = 9000

const TAG_KEYWORDS: Record<string, string[]> = {
  "User Research": ["research", "user research", "usability", "testing", "interview", "survey", "ethnograph", "persona"],
  Prototyping: ["prototype", "prototyping", "wireframe", "mockup"],
  "Vibe Coding": ["vibe coding", "vibe", "cursor", "copilot", "code generation", "ai coding", "v0"],
  Examples: ["example", "case study", "showcase", "demo", "sample"],
  Ethics: ["ethics", "ethical", "bias", "privacy", "consent", "responsible", "fairness"],
  Claude: ["claude", "anthropic"],
  Chatgpt: ["chatgpt", "gpt", "openai"],
  Gemini: ["gemini", "google ai", "bard"],
  Midjourney: ["midjourney", "image generation", "ai art"],
  Figma: ["figma", "design tool"],
  Tutorial: ["tutorial", "guide", "how to", "learn", "course", "lesson", "walkthrough"],
  "Qualitative Methods": ["qualitative", "interview", "focus group", "thematic", "grounded theory"],
  Methodology: ["methodology", "method", "framework", "approach", "process", "technique"],
  "Ai Literacy": ["ai literacy", "literacy"],
  LLM: ["llm", "large language model", "transformer"],
  Agents: ["agent", "agents", "autonomous"],
  "Prompting Techniques": ["prompt", "prompting", "prompt engineering"],
}

/** Set to false after the first failed call so we stop retrying a missing endpoint. */
let serverScrapeAvailable: boolean | null = null

function extractTags(text: string): string[] {
  const lowerText = text.toLowerCase()
  const suggestedTags: string[] = []

  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        if (!suggestedTags.includes(tag)) suggestedTags.push(tag)
        break
      }
    }
  }

  return suggestedTags.slice(0, 5)
}

export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

function extractVimeoVideoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return match ? match[1] : null
}

export function extractDriveFileId(url: string): string | null {
  const match =
    url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/open\?id=([A-Za-z0-9_-]+)/) ||
    url.match(/docs\.google\.com\/[a-z]+\/d\/([A-Za-z0-9_-]+)/)
  return match ? match[1] : null
}

function parseYear(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 1900 && value <= new Date().getFullYear() + 1 ? Math.trunc(value) : undefined
  }
  if (typeof value !== "string") return undefined
  const match = value.match(/(19|20)\d{2}/)
  if (!match) return undefined
  const year = Number(match[0])
  return year >= 1900 && year <= new Date().getFullYear() + 1 ? year : undefined
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    return response.ok ? response : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJson(url: string, timeoutMs?: number): Promise<any | null> {
  const response = await fetchWithTimeout(url, timeoutMs)
  if (!response) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function fetchText(url: string, timeoutMs?: number): Promise<string | null> {
  const response = await fetchWithTimeout(url, timeoutMs)
  if (!response) return null
  try {
    return await response.text()
  } catch {
    return null
  }
}

/** Drops values we never want to persist in the library XML. */
function usableThumbnail(value: unknown): string {
  if (typeof value !== "string" || !value) return ""
  if (value.startsWith("data:")) return ""
  // Drive viewer links are short-lived signed URLs.
  if (value.includes("drive.google.com/drive-viewer/")) return ""
  // Favicons are too small to work as card artwork.
  if (value.includes("s2/favicons") || /favicon\.(ico|png)/i.test(value)) return ""
  return value
}

/** Metadata services sometimes report the host app instead of a real author. */
function usableAuthor(value: string): string {
  return /^(google (docs|drive|sheets|slides)|drive|untitled)$/i.test(value.trim()) ? "" : value
}

/** Filters license/copyright lines that reader extraction can pick up from PDFs. */
function usableSummary(value: string): string {
  if (/creativecommons\.org\/licenses/i.test(value)) return ""
  if (/^\s*\d{4}-\d{3,4}[\dxX]?\s*\/?\s*©/.test(value)) return ""
  return value
}

/** Confirms an image URL actually loads, so we never leave a broken thumbnail behind. */
function imageLoads(url: string, minWidth = 200): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(true)
  return new Promise((resolve) => {
    const image = new window.Image()
    const timer = setTimeout(() => {
      image.src = ""
      resolve(false)
    }, 6000)
    image.onload = () => {
      clearTimeout(timer)
      resolve(image.naturalWidth >= minWidth)
    }
    image.onerror = () => {
      clearTimeout(timer)
      resolve(false)
    }
    image.src = url
  })
}

async function youtubeThumbnail(videoId: string): Promise<string> {
  const maxres = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
  if (await imageLoads(maxres, 640)) return maxres
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

/** Primary path: same-origin PHP endpoint that ships with the static export. */
async function serverScrape(url: string): Promise<Partial<ScrapeResult> | null> {
  if (serverScrapeAvailable === false) return null

  const endpoint = `${withBasePath(SCRAPE_ENDPOINT)}?url=${encodeURIComponent(url)}`
  const data = await fetchJson(endpoint)

  if (!data || typeof data !== "object") {
    serverScrapeAvailable = false
    return null
  }
  serverScrapeAvailable = true

  return {
    title: typeof data.title === "string" ? data.title : "",
    author: typeof data.author === "string" ? data.author : "",
    summary: typeof data.summary === "string" ? data.summary : "",
    thumbnail: usableThumbnail(data.thumbnail),
    year: parseYear(data.year),
    type: typeof data.type === "string" ? (data.type as ResourceType) : undefined,
    duration: typeof data.duration === "string" ? data.duration : undefined,
  }
}

/** CORS-friendly oEmbed proxy; YouTube's own oEmbed endpoint sends no CORS headers. */
async function noembedScrape(url: string): Promise<Partial<ScrapeResult> | null> {
  const data = await fetchJson(`https://noembed.com/embed?url=${encodeURIComponent(url)}`)
  if (!data || data.error) return null

  return {
    title: typeof data.title === "string" ? data.title : "",
    author: typeof data.author_name === "string" ? data.author_name : "",
    summary: typeof data.description === "string" ? data.description.slice(0, 700) : "",
    thumbnail: usableThumbnail(data.thumbnail_url),
    type: data.type === "video" ? "video" : undefined,
  }
}

/** CORS-friendly metadata API used when the PHP endpoint is unavailable (e.g. local dev). */
async function microlinkScrape(url: string): Promise<Partial<ScrapeResult> | null> {
  const data = await fetchJson(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
  if (!data || data.status !== "success" || !data.data) return null

  const meta = data.data
  const author = typeof meta.author === "string" && meta.author ? meta.author : meta.publisher

  return {
    title: typeof meta.title === "string" ? meta.title : "",
    author: typeof author === "string" ? author : "",
    summary: typeof meta.description === "string" ? meta.description.slice(0, 700) : "",
    thumbnail: usableThumbnail(meta.image?.url) || usableThumbnail(meta.logo?.url),
    year: parseYear(meta.date),
  }
}

/**
 * Reader service that returns page text with CORS enabled. Used when the other
 * sources come up empty; it reaches sites that block metadata APIs.
 */
async function readerScrape(url: string): Promise<Partial<ScrapeResult> | null> {
  const text = await fetchText(`https://r.jina.ai/${url}`)
  if (!text) return null

  const titleMatch = text.match(/^Title:\s*(.+)$/m)
  const publishedMatch = text.match(/^Published Time:\s*(.+)$/m)
  const contentMatch = text.match(/^Markdown Content:\s*\n([\s\S]*)$/m)

  let summary = ""
  if (contentMatch) {
    const firstParagraph = contentMatch[1]
      .split(/\n{2,}/)
      .map((block) => block.replace(/[#*_>`]|\[|\]\([^)]*\)/g, "").trim())
      .find((block) => block.length > 80)
    summary = firstParagraph ? firstParagraph.slice(0, 700) : ""
  }

  return {
    title: titleMatch ? titleMatch[1].trim() : "",
    summary,
    year: publishedMatch ? parseYear(publishedMatch[1]) : undefined,
  }
}

function mergeResult(
  base: ScrapeResult,
  incoming: Partial<ScrapeResult> | null
): ScrapeResult {
  if (!incoming) return base
  return {
    ...base,
    title: base.title || incoming.title || "",
    author: base.author || incoming.author || "",
    summary: base.summary || incoming.summary || "",
    thumbnail: base.thumbnail || incoming.thumbnail || "",
    year: base.year ?? incoming.year,
    duration: base.duration ?? incoming.duration,
    type: incoming.type ?? base.type,
  }
}

/**
 * Fetches metadata for a URL from the browser.
 *
 * Order: same-origin scrape.php (cPanel) -> noembed (video) / microlink (pages)
 * -> platform-specific thumbnail fallbacks. Fields already filled are preserved.
 */
export async function scrapeUrlMetadata(url: string): Promise<ScrapeResult> {
  const trimmedUrl = url.trim()
  let result: ScrapeResult = {
    title: "",
    author: "",
    summary: "",
    thumbnail: "",
    suggestedTags: [],
    type: detectResourceType(trimmedUrl),
    found: false,
  }

  if (!trimmedUrl || !/^https?:\/\//i.test(trimmedUrl)) return result

  const youtubeId = extractYouTubeVideoId(trimmedUrl)
  const vimeoId = extractVimeoVideoId(trimmedUrl)
  const driveId = extractDriveFileId(trimmedUrl)

  result = mergeResult(result, await serverScrape(trimmedUrl))

  if (youtubeId || vimeoId) {
    if (!result.title || !result.thumbnail) {
      result = mergeResult(result, await noembedScrape(trimmedUrl))
    }
    result.type = "video"
    if (youtubeId) {
      // Prefer the highest-resolution art that actually exists.
      if (!result.thumbnail || /hqdefault|mqdefault|default\.jpg/.test(result.thumbnail)) {
        result.thumbnail = await youtubeThumbnail(youtubeId)
      }
    }
  } else {
    if (!result.title || !result.summary || !result.year) {
      result = mergeResult(result, await microlinkScrape(trimmedUrl))
    }
    if (!result.title || !result.summary) {
      result = mergeResult(result, await readerScrape(trimmedUrl))
    }

    if (driveId) {
      // Stable Drive thumbnail; the viewer URLs other services return expire.
      result.thumbnail = `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`
      if (/\.pdf$/i.test(result.title)) {
        result.type = "pdf"
      }
      result.title = result.title.replace(/\.(pdf|docx?|pptx?)$/i, "").trim()
    }
  }

  result.author = usableAuthor(result.author)
  result.summary = usableSummary(result.summary)

  // A generic or generated image shouldn't count as a successful lookup.
  const foundRealMetadata = Boolean(
    result.title || result.summary || result.year || result.thumbnail
  )

  if (!result.thumbnail) {
    if (result.type === "pdf") {
      result.thumbnail = "/pdf-thumbnail.jpg"
    } else if (result.type === "link") {
      // Live screenshot service; not pre-verified because generation can be slow.
      result.thumbnail = `https://image.thum.io/get/width/1200/crop/800/${trimmedUrl}`
    }
  }

  result.suggestedTags = extractTags(
    `${result.title} ${result.summary} ${result.author} ${trimmedUrl}`
  )
  result.found = foundRealMetadata

  return result
}
