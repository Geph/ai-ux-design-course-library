import { detectResourceType, generateId } from "./xml-utils"
import { extractYouTubeVideoId } from "./scrape-url"
import type { Resource, ResourceType } from "./types"

const RESOURCE_TYPES: ResourceType[] = ["pdf", "video", "link", "graphic"]

export interface ParsedJsonResources {
  resources: Resource[]
  errors: string[]
}

function today(): string {
  return new Date().toISOString().split("T")[0]
}

/**
 * A JSON file students can fill in offline and import. Keys beginning with an
 * underscore are documentation only and are ignored on import.
 */
export function resourceTemplateJson(): string {
  const template = {
    _instructions: [
      "Add one object per resource inside the \"resources\" array below.",
      "Only \"title\" and \"url\" are required; everything else is filled in automatically when left out.",
      "\"type\" must be one of: pdf, video, link, graphic. Omit it to detect the type from the URL.",
      "\"tags\" is a list of short topic labels, for example: [\"User Research\", \"Tutorial\"].",
      "Import this file from Settings > Data Management > Add from JSON. Existing resources are never overwritten.",
    ],
    _fields: {
      title: "string (required)",
      url: "string (required) - link to the resource",
      type: "pdf | video | link | graphic (optional)",
      author: "string (optional)",
      year: "number (optional), e.g. 2026",
      summary: "string (optional)",
      tags: "array of strings (optional)",
      thumbnail: "image URL (optional)",
    },
    resources: [
      {
        title: "Example: Using AI for UX Work",
        url: "https://www.nngroup.com/articles/ai-work-study-guide/",
        type: "link",
        author: "Nielsen Norman Group",
        year: 2025,
        summary: "A short description of what this resource covers and why it is useful for the course.",
        tags: ["User Research", "Examples"],
        thumbnail: "",
      },
      {
        title: "Example: minimal entry",
        url: "https://www.youtube.com/watch?v=aircAruvnKk",
      },
    ],
  }

  return JSON.stringify(template, null, 2)
}

/** Triggers a browser download of a text file. */
export function downloadTextFile(contents: string, filename: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.style.display = "none"
  document.body.appendChild(anchor)
  anchor.click()

  setTimeout(() => {
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, 100)
}

function titleCaseTag(tag: string): string {
  const trimmed = tag.trim()
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 1) return trimmed
  return trimmed
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

function defaultThumbnail(type: ResourceType, url: string): string {
  const youtubeId = extractYouTubeVideoId(url)
  if (youtubeId) return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
  return type === "pdf" ? "/pdf-thumbnail.jpg" : "/url-thumbnail.jpg"
}

function normalizeEntry(entry: unknown, index: number, errors: string[]): Resource | null {
  const label = `Item ${index + 1}`

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    errors.push(`${label}: not a JSON object.`)
    return null
  }

  const raw = entry as Record<string, unknown>
  const title = typeof raw.title === "string" ? raw.title.trim() : ""
  const url = typeof raw.url === "string" ? raw.url.trim() : ""

  if (!title && !url) {
    errors.push(`${label}: needs at least a "title" or a "url".`)
    return null
  }

  const requestedType = typeof raw.type === "string" ? (raw.type.trim().toLowerCase() as ResourceType) : undefined
  const type = requestedType && RESOURCE_TYPES.includes(requestedType) ? requestedType : detectResourceType(url)
  if (requestedType && !RESOURCE_TYPES.includes(requestedType)) {
    errors.push(`${label}: unknown type "${raw.type}" - using "${type}" instead.`)
  }

  const tags = Array.isArray(raw.tags)
    ? Array.from(
        new Set(
          raw.tags
            .filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "")
            .map(titleCaseTag)
        )
      )
    : []

  const yearValue = typeof raw.year === "string" ? Number(raw.year) : raw.year
  const year =
    typeof yearValue === "number" && Number.isFinite(yearValue) && yearValue >= 1900
      ? Math.trunc(yearValue)
      : undefined

  const thumbnail = typeof raw.thumbnail === "string" && raw.thumbnail.trim() !== ""
    ? raw.thumbnail.trim()
    : defaultThumbnail(type, url)

  return {
    id: typeof raw.id === "string" && raw.id.trim() !== "" ? raw.id.trim() : generateId(),
    title: title || url,
    type,
    url: url || "#",
    thumbnail,
    summary: typeof raw.summary === "string" ? raw.summary.trim() : "",
    tags,
    dateAdded: typeof raw.dateAdded === "string" && raw.dateAdded.trim() !== "" ? raw.dateAdded.trim() : today(),
    author: typeof raw.author === "string" && raw.author.trim() !== "" ? raw.author.trim().slice(0, 160) : undefined,
    year,
  }
}

/**
 * Reads a JSON file of resources to add. Accepts either a bare array or an
 * object with a "resources" array (the shape produced by the template).
 */
export function parseResourcesJson(text: string): ParsedJsonResources {
  const errors: string[] = []
  let payload: unknown

  try {
    payload = JSON.parse(text)
  } catch {
    return { resources: [], errors: ["The file is not valid JSON."] }
  }

  let entries: unknown[]
  if (Array.isArray(payload)) {
    entries = payload
  } else if (payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).resources)) {
    entries = (payload as Record<string, unknown>).resources as unknown[]
  } else {
    return {
      resources: [],
      errors: ['Expected a JSON array of resources, or an object with a "resources" array.'],
    }
  }

  const resources: Resource[] = []
  entries.forEach((entry, index) => {
    const normalized = normalizeEntry(entry, index, errors)
    if (normalized) resources.push(normalized)
  })

  return { resources, errors }
}

/** Splits incoming resources into genuinely new items and duplicates. */
export function separateDuplicates(
  incoming: Resource[],
  existing: Resource[]
): { additions: Resource[]; duplicates: Resource[] } {
  const existingUrls = new Set(
    existing.map((r) => r.url.trim().toLowerCase()).filter((url) => url && url !== "#")
  )
  const existingTitles = new Set(existing.map((r) => r.title.trim().toLowerCase()))
  const existingIds = new Set(existing.map((r) => r.id))

  const additions: Resource[] = []
  const duplicates: Resource[] = []

  for (const resource of incoming) {
    const url = resource.url.trim().toLowerCase()
    const title = resource.title.trim().toLowerCase()
    const isDuplicate =
      existingIds.has(resource.id) ||
      existingTitles.has(title) ||
      (url !== "" && url !== "#" && existingUrls.has(url))

    if (isDuplicate) {
      duplicates.push(resource)
      continue
    }

    additions.push(resource)
    existingIds.add(resource.id)
    existingTitles.add(title)
    if (url && url !== "#") existingUrls.add(url)
  }

  return { additions, duplicates }
}
