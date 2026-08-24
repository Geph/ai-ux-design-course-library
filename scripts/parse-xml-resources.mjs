import fs from "fs"

const xmlPath =
  "g:/.shortcut-targets-by-id/1YPjojTqo9XjO2_VNyFSLtIaaWl1FRIcL/UXD with AI (Spring 2026)/uxd-ai-resources.xml"

function decodeXml(str) {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

const xml = fs.readFileSync(xmlPath, "utf8")
const resources = []
const re = /<resource>([\s\S]*?)<\/resource>/g
let m
while ((m = re.exec(xml))) {
  const block = m[1]
  const get = (tag) => {
    const mm = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
    return mm ? decodeXml(mm[1]) : ""
  }
  const tags = []
  const tagsMatch = block.match(/<tags>([\s\S]*?)<\/tags>/)
  if (tagsMatch) {
    const tre = /<tag>([\s\S]*?)<\/tag>/g
    let tm
    while ((tm = tre.exec(tagsMatch[1]))) {
      tags.push(decodeXml(tm[1]))
    }
  }

  let thumbnail = get("thumbnail")
  // Normalize local/default thumbnails for /uxd basePath hosting
  if (
    thumbnail === "/url-thumbnail.jpg" ||
    thumbnail === "/pdf-thumbnail.jpg" ||
    thumbnail === "https://invite.illinois.edu/pdf-thumbnail.jpg" ||
    thumbnail === "https://invite.illinois.edu/uxd/pdf-thumbnail.jpg" ||
    thumbnail.endsWith("/pdf-thumbnail.jpg") ||
    thumbnail.endsWith("/url-thumbnail.jpg")
  ) {
    thumbnail = thumbnail.includes("pdf") ? "/pdf-thumbnail.jpg" : "/url-thumbnail.jpg"
  }

  const year = get("year")
  const localPath = get("localPath")

  resources.push({
    id: get("id"),
    title: get("title"),
    type: get("type"),
    url: get("url"),
    thumbnail,
    summary: get("summary"),
    tags,
    dateAdded: get("dateAdded"),
    author: get("author") || undefined,
    year: year ? Number(year) : undefined,
    localPath: localPath || undefined,
  })
}

function serializeResource(r) {
  const lines = ["  {"]
  lines.push(`    id: ${JSON.stringify(r.id)},`)
  lines.push(`    title: ${JSON.stringify(r.title)},`)
  lines.push(`    type: ${JSON.stringify(r.type)},`)
  lines.push(`    url: ${JSON.stringify(r.url)},`)
  lines.push(`    thumbnail: ${JSON.stringify(r.thumbnail)},`)
  lines.push(`    summary: ${JSON.stringify(r.summary)},`)
  lines.push(`    tags: ${JSON.stringify(r.tags)},`)
  lines.push(`    dateAdded: ${JSON.stringify(r.dateAdded)},`)
  if (r.author) lines.push(`    author: ${JSON.stringify(r.author)},`)
  if (r.year !== undefined && !Number.isNaN(r.year)) lines.push(`    year: ${r.year},`)
  if (r.localPath) lines.push(`    localPath: ${JSON.stringify(r.localPath)},`)
  lines.push("  }")
  return lines.join("\n")
}

const ts = `import type { Resource, TagWithCount } from "./types"

/** Default library resources synced from uxd-ai-resources.xml (Spring 2026). */
export const RESOURCES_DATA_VERSION = "2026-05-04-uxd-ai"

export type { Resource, ResourceType, TagWithCount } from "./types"

/** A tag only counts as popular once more than this many resources use it. */
export const POPULAR_TAG_MIN_REFERENCES = 5

export const resources: Resource[] = [
${resources.map(serializeResource).join(",\n")}
]

export function getPopularTags(items: Resource[]): TagWithCount[] {
  const tagCounts: { [key: string]: number } = {}

  items.forEach((item) => {
    item.tags?.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    })
  })

  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .filter(({ count }) => count > POPULAR_TAG_MIN_REFERENCES)
    .sort((a, b) => b.count - a.count)
}

export function getAllTags(items: Resource[]): TagWithCount[] {
  const tagCounts: { [key: string]: number } = {}

  items.forEach((item) => {
    item.tags?.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    })
  })

  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
}
`

fs.writeFileSync("lib/resources-data.ts", ts)
fs.copyFileSync(xmlPath, "public/resources.xml")
console.log(`Wrote ${resources.length} resources to lib/resources-data.ts`)
console.log(`Copied XML to public/resources.xml`)
console.log(
  "Relative thumbs:",
  resources.filter((r) => r.thumbnail.startsWith("/")).map((r) => `${r.id}: ${r.thumbnail}`)
)
