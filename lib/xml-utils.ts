import type { Resource, ResourceType } from "./types"

/**
 * Detects the resource type based on URL
 */
export function detectResourceType(url: string): ResourceType {
  if (!url) return "link"
  
  const lowerUrl = url.toLowerCase()
  
  // Check for video platforms
  if (
    lowerUrl.includes("youtube.com") ||
    lowerUrl.includes("youtu.be") ||
    lowerUrl.includes("vimeo.com") ||
    lowerUrl.includes("loom.com") ||
    lowerUrl.includes("wistia.com")
  ) {
    return "video"
  }
  
  // Check for PDF files (including URLs with query strings)
  if (lowerUrl.endsWith(".pdf") || /\.pdf(\?|#)/.test(lowerUrl) || lowerUrl.includes("arxiv.org/pdf")) {
    return "pdf"
  }
  
  // Check for image files
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
  
  // Default to link
  return "link"
}

/**
 * Generates a unique ID for resources
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generates an APA-style citation for a resource
 */
export function generateApaCitation(resource: Resource): string {
  const author = resource.author || "Unknown Author"
  const year = resource.year || new Date(resource.dateAdded).getFullYear()
  const title = resource.title
  
  // Basic APA format: Author, A. A. (Year). Title. Retrieved from URL
  let citation = `${author} (${year}). ${title}.`
  
  if (resource.url && resource.url !== "#") {
    citation += ` Retrieved from ${resource.url}`
  }
  
  return citation
}

/**
 * Exports resources to an XML file and triggers a download (client-side)
 */
export async function exportXmlFile(resources: Resource[], filename: string): Promise<void> {
  if (!resources || resources.length === 0) {
    alert("No resources to export")
    return
  }
  
  try {
    // Yield to event loop to prevent blocking UI
    await new Promise(resolve => setTimeout(resolve, 0))
    
    // Generate XML client-side
    const xml = resourcesToXml(resources)
    
    // Create blob and download
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.style.display = "none"
    document.body.appendChild(a)
    
    // Yield to event loop before triggering click
    await new Promise(resolve => setTimeout(resolve, 0))
    a.click()
    
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 100)
  } catch (error) {
    console.error("Export failed:", error)
    alert("Failed to export resources")
  }
}

/**
 * Converts resources array to XML string
 */
export function resourcesToXml(resources: Resource[]): string {
  const escapeXml = (str: string) => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<resources>\n'

  resources.forEach((resource) => {
    xml += '  <resource>\n'
    xml += `    <id>${escapeXml(resource.id)}</id>\n`
    xml += `    <title>${escapeXml(resource.title)}</title>\n`
    xml += `    <type>${escapeXml(resource.type)}</type>\n`
    xml += `    <url>${escapeXml(resource.url)}</url>\n`
    xml += `    <thumbnail>${escapeXml(resource.thumbnail)}</thumbnail>\n`
    xml += `    <summary>${escapeXml(resource.summary)}</summary>\n`
    xml += `    <dateAdded>${escapeXml(resource.dateAdded)}</dateAdded>\n`
    
    if (resource.author) {
      xml += `    <author>${escapeXml(resource.author)}</author>\n`
    }
    
    if (resource.year) {
      xml += `    <year>${resource.year}</year>\n`
    }
    
    if (resource.localPath) {
      xml += `    <localPath>${escapeXml(resource.localPath)}</localPath>\n`
    }
    
    if (resource.tags && resource.tags.length > 0) {
      xml += '    <tags>\n'
      resource.tags.forEach((tag) => {
        xml += `      <tag>${escapeXml(tag)}</tag>\n`
      })
      xml += '    </tags>\n'
    }
    
    xml += '  </resource>\n'
  })

  xml += '</resources>\n'
  return xml
}

/**
 * Parses XML string and converts to resources array
 */
export function xmlToResources(xmlString: string): Resource[] {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlString, "text/xml")
  
  // Check for parsing errors
  const parseError = xmlDoc.querySelector("parsererror")
  if (parseError) {
    throw new Error("Invalid XML format")
  }
  
  const resourceElements = xmlDoc.querySelectorAll("resource")
  const resources: Resource[] = []
  
  resourceElements.forEach((element) => {
    const getTextContent = (tagName: string): string => {
      return element.querySelector(tagName)?.textContent || ""
    }
    
    const getNumberContent = (tagName: string): number | undefined => {
      const text = element.querySelector(tagName)?.textContent
      return text ? Number(text) : undefined
    }
    
    const tags: string[] = []
    const tagElements = element.querySelectorAll("tags > tag")
    tagElements.forEach((tagElement) => {
      const tagText = tagElement.textContent
      if (tagText) tags.push(tagText)
    })
    
    const resource: Resource = {
      id: getTextContent("id"),
      title: getTextContent("title"),
      type: getTextContent("type") as Resource["type"],
      url: getTextContent("url"),
      thumbnail: getTextContent("thumbnail"),
      summary: getTextContent("summary"),
      tags,
      dateAdded: getTextContent("dateAdded"),
      author: getTextContent("author") || undefined,
      year: getNumberContent("year"),
      localPath: getTextContent("localPath") || undefined,
    }
    
    resources.push(resource)
  })
  
  return resources
}
