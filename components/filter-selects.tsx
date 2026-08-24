"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ResourceType, TagWithCount } from "@/lib/resources-data"

const TYPE_OPTIONS: { value: ResourceType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "pdf", label: "Papers" },
  { value: "video", label: "Videos" },
  { value: "link", label: "Links" },
  { value: "graphic", label: "Graphics" },
]

interface FilterSelectsProps {
  selectedType: ResourceType | "all"
  onTypeChange: (type: ResourceType | "all") => void
  selectedTags: string[]
  onTagChange: (tag: string | "all") => void
  tags: TagWithCount[]
}

export function FilterSelects({
  selectedType,
  onTypeChange,
  selectedTags,
  onTagChange,
  tags,
}: FilterSelectsProps) {
  const tagValue = selectedTags.length === 1 ? selectedTags[0] : "all"

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Select
        value={selectedType}
        onValueChange={(value) => onTypeChange(value as ResourceType | "all")}
      >
        <SelectTrigger className="h-11 w-[140px] rounded-xl border-2 bg-card shadow-sm" aria-label="Filter by type">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={tagValue}
        onValueChange={(value) => onTagChange(value)}
      >
        <SelectTrigger className="h-11 w-[160px] rounded-xl border-2 bg-card shadow-sm" aria-label="Filter by tag">
          <SelectValue placeholder="Tags" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="all">
            {selectedTags.length > 1 ? `Tags (${selectedTags.length})` : "All tags"}
          </SelectItem>
          {tags.map((tagData) => (
            <SelectItem key={tagData.tag} value={tagData.tag}>
              {tagData.tag} ({tagData.count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
