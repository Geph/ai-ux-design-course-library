import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const driveDir =
  "g:/.shortcut-targets-by-id/1YPjojTqo9XjO2_VNyFSLtIaaWl1FRIcL/UXD with AI (Spring 2026)"
const driveJsonPath = path.join(driveDir, "uxd-ai-resources.json")
const driveXmlPath = path.join(driveDir, "uxd-ai-resources.xml")
const publicJsonPath = path.join(root, "public", "resources.json")
const dataTsPath = path.join(root, "lib", "resources-data.ts")

function decodeXml(str) {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

function normalizeThumbnail(thumbnail) {
  if (
    thumbnail === "/url-thumbnail.jpg" ||
    thumbnail === "/pdf-thumbnail.jpg" ||
    thumbnail === "https://invite.illinois.edu/pdf-thumbnail.jpg" ||
    thumbnail === "https://invite.illinois.edu/uxd/pdf-thumbnail.jpg" ||
    thumbnail.endsWith("/pdf-thumbnail.jpg") ||
    thumbnail.endsWith("/url-thumbnail.jpg")
  ) {
    return thumbnail.includes("pdf") ? "/pdf-thumbnail.jpg" : "/url-thumbnail.jpg"
  }
  return thumbnail
}

function parseXmlLibrary(xml) {
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

    const year = get("year")
    const localPath = get("localPath")

    resources.push({
      id: get("id"),
      title: get("title"),
      type: get("type"),
      url: get("url"),
      thumbnail: normalizeThumbnail(get("thumbnail")),
      summary: get("summary"),
      tags,
      dateAdded: get("dateAdded"),
      author: get("author") || undefined,
      year: year ? Number(year) : undefined,
      localPath: localPath || undefined,
    })
  }
  return resources
}

function parseJsonLibrary(text) {
  const payload = JSON.parse(text)
  const entries = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.resources)
      ? payload.resources
      : null

  if (!entries) {
    throw new Error('JSON source must be an array or an object with a "resources" array')
  }

  return entries.map((entry) => ({
    id: String(entry.id ?? ""),
    title: String(entry.title ?? ""),
    type: String(entry.type ?? "link"),
    url: String(entry.url ?? ""),
    thumbnail: normalizeThumbnail(String(entry.thumbnail ?? "")),
    summary: String(entry.summary ?? ""),
    tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
    dateAdded: String(entry.dateAdded ?? ""),
    author: entry.author ? String(entry.author) : undefined,
    year: entry.year !== undefined && entry.year !== "" ? Number(entry.year) : undefined,
    localPath: entry.localPath ? String(entry.localPath) : undefined,
  }))
}

function loadFromPath(filePath) {
  const absolute = path.resolve(root, filePath)
  if (!fs.existsSync(absolute)) {
    throw new Error(`Source file not found: ${absolute}`)
  }
  const text = fs.readFileSync(absolute, "utf8")
  const lower = absolute.toLowerCase()
  if (lower.endsWith(".json")) {
    return { resources: parseJsonLibrary(text), source: absolute }
  }
  if (lower.endsWith(".xml")) {
    return { resources: parseXmlLibrary(text), source: absolute }
  }
  throw new Error(`Unsupported source type (use .json or .xml): ${absolute}`)
}

function loadResources() {
  const cliSource = process.argv[2]
  if (cliSource) {
    console.log(`Reading CLI source ${cliSource}`)
    return loadFromPath(cliSource)
  }

  if (fs.existsSync(driveJsonPath)) {
    console.log(`Reading ${driveJsonPath}`)
    return { resources: parseJsonLibrary(fs.readFileSync(driveJsonPath, "utf8")), source: "drive-json" }
  }

  if (fs.existsSync(driveXmlPath)) {
    console.log(`Reading ${driveXmlPath} (XML fallback — prefer uxd-ai-resources.json going forward)`)
    return { resources: parseXmlLibrary(fs.readFileSync(driveXmlPath, "utf8")), source: "drive-xml" }
  }

  if (fs.existsSync(publicJsonPath)) {
    console.log(`Drive file missing; reading ${publicJsonPath}`)
    return { resources: parseJsonLibrary(fs.readFileSync(publicJsonPath, "utf8")), source: "public-json" }
  }

  throw new Error(
    "No resource source found. Pass a path, or provide Drive uxd-ai-resources.json (or .xml), or public/resources.json."
  )
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

function toPublicJson(resources) {
  return `${JSON.stringify(
    {
      exportDate: new Date().toISOString(),
      course: "User Experience Design with AI",
      totalResources: resources.length,
      resources: resources.map((r) => {
        const item = {
          id: r.id,
          title: r.title,
          type: r.type,
          url: r.url,
          thumbnail: r.thumbnail,
          summary: r.summary,
          tags: r.tags,
          dateAdded: r.dateAdded,
        }
        if (r.author) item.author = r.author
        if (r.year !== undefined && !Number.isNaN(r.year)) item.year = r.year
        if (r.localPath) item.localPath = r.localPath
        return item
      }),
    },
    null,
    2
  )}\n`
}

const { resources, source } = loadResources()
const cliLabel = process.argv[2] ? path.basename(process.argv[2], path.extname(process.argv[2])) : "json"
const versionStamp = `${new Date().toISOString().slice(0, 10)}-${cliLabel}`

const ts = `import type { Resource, TagWithCount } from "./types"

/** Default library resources synced from the course JSON. */
export const RESOURCES_DATA_VERSION = "${versionStamp}"

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

const publicJson = toPublicJson(resources)
fs.writeFileSync(dataTsPath, ts)
fs.writeFileSync(publicJsonPath, publicJson)

// Keep the course Drive JSON current whenever we can write it.
if (fs.existsSync(driveDir)) {
  try {
    fs.writeFileSync(driveJsonPath, publicJson)
    console.log(`Wrote Drive JSON: ${driveJsonPath}`)
  } catch (err) {
    console.warn(`Could not write Drive JSON: ${err.message}`)
  }
}

const staleXml = path.join(root, "public", "resources.xml")
if (fs.existsSync(staleXml)) {
  fs.unlinkSync(staleXml)
  console.log("Removed public/resources.xml")
}

console.log(`Source: ${source}`)
console.log(`Wrote ${resources.length} resources to lib/resources-data.ts`)
console.log(`Wrote public/resources.json`)
console.log(
  "Relative thumbs:",
  resources.filter((r) => r.thumbnail.startsWith("/")).map((r) => `${r.id}: ${r.thumbnail}`)
)
