export type ResourceType = "pdf" | "video" | "link" | "graphic"

export interface Resource {
  id: string
  title: string
  type: ResourceType
  url: string
  thumbnail: string
  summary: string
  tags: string[]
  dateAdded: string
  author?: string
  year?: number
  localPath?: string
  /** When true, the resource stays at the top of the gallery. */
  pinned?: boolean
}

export interface TagWithCount {
  tag: string
  count: number
}
