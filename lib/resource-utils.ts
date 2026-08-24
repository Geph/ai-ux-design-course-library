import type { Resource, ResourceType } from "./types"

/** Detects the resource type based on URL. */
export function detectResourceType(url: string): ResourceType {
  if (!url) return "link"

  const lowerUrl = url.toLowerCase()

  if (
    lowerUrl.includes("youtube.com") ||
    lowerUrl.includes("youtu.be") ||
    lowerUrl.includes("vimeo.com") ||
    lowerUrl.includes("loom.com") ||
    lowerUrl.includes("wistia.com")
  ) {
    return "video"
  }

  if (lowerUrl.endsWith(".pdf") || /\.pdf(\?|#)/.test(lowerUrl) || lowerUrl.includes("arxiv.org/pdf")) {
    return "pdf"
  }

  if (
    lowerUrl.endsWith(".jpg") ||
    lowerUrl.endsWith(".jpeg") ||
    lowerUrl.endsWith(".png") ||
    lowerUrl.endsWith(".gif") ||
    lowerUrl.endsWith(".svg") ||
    lowerUrl.endsWith(".webp")
  ) {
    return "graphic"
  }

  return "link"
}

/** Generates a unique ID for resources. */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/** Generates an APA-style citation for a resource. */
export function generateApaCitation(resource: Resource): string {
  const author = resource.author || "Unknown Author"
  const year = resource.year || new Date(resource.dateAdded).getFullYear()
  const title = resource.title

  let citation = `${author} (${year}). ${title}.`

  if (resource.url && resource.url !== "#") {
    citation += ` Retrieved from ${resource.url}`
  }

  return citation
}
