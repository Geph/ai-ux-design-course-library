"use client"

import { FileText, Play, Link, User, Settings, ImageIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Resource, ResourceType } from "@/lib/resources-data"
import { withBasePath } from "@/lib/base-path"
import { cn } from "@/lib/utils"

interface ResourceCardProps {
  resource: Resource
  onTagClick: (tag: string) => void
  onEditClick: (resource: Resource) => void
}

const typeConfig: Record<ResourceType, { icon: typeof FileText; label: string; color: string; bgColor: string }> = {
  pdf: { 
    icon: FileText, 
    label: "PDF", 
    color: "text-white",
    bgColor: "bg-[oklch(0.60_0.22_25)]"
  },
  video: { 
    icon: Play, 
    label: "Video", 
    color: "text-white",
    bgColor: "bg-[oklch(0.60_0.20_330)]"
  },
  link: { 
    icon: Link, 
    label: "Link", 
    color: "text-white",
    bgColor: "bg-[oklch(0.55_0.22_250)]"
  },
  graphic: {
    icon: ImageIcon,
    label: "Graphic",
    color: "text-white",
    bgColor: "bg-[oklch(0.70_0.18_145)]"
  }
}

const tagColors = [
  "bg-[oklch(0.55_0.22_250)]/10 text-[oklch(0.45_0.22_250)] hover:bg-[oklch(0.55_0.22_250)]/20",
  "bg-[oklch(0.70_0.20_330)]/10 text-[oklch(0.55_0.20_330)] hover:bg-[oklch(0.70_0.20_330)]/20",
  "bg-[oklch(0.70_0.15_180)]/10 text-[oklch(0.55_0.15_180)] hover:bg-[oklch(0.70_0.15_180)]/20",
  "bg-[oklch(0.75_0.18_55)]/15 text-[oklch(0.55_0.18_55)] hover:bg-[oklch(0.75_0.18_55)]/25",
  "bg-[oklch(0.70_0.18_145)]/10 text-[oklch(0.55_0.18_145)] hover:bg-[oklch(0.70_0.18_145)]/20",
]

export function ResourceCard({ resource, onTagClick, onEditClick }: ResourceCardProps) {
  const config = typeConfig[resource.type]
  const Icon = config.icon

  // Determine link URL - local PDFs go to local path, others use the URL
  const resourceUrl = resource.localPath || resource.url

  return (
    <Card className="group overflow-hidden border-border bg-card hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
      {/* Title Section - Above Image */}
      <CardContent className="px-3 py-1">
        <a 
          href={resourceUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="block"
        >
          <h3 className="font-semibold text-lg text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {resource.title}
          </h3>
        </a>
      </CardContent>

      {/* Thumbnail with Type Overlay and Cite Button */}
      <a 
        href={resourceUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="block relative aspect-video overflow-hidden"
      >
        <img
          src={withBasePath(resource.thumbnail || "/placeholder.svg")}
          alt={resource.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {/* Top Row: Type Badge and Edit Button */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg",
            config.bgColor,
            config.color
          )}>
            <Icon className="h-4 w-4" />
            <span className="text-xs font-semibold">{config.label}</span>
          </div>
          
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-8 p-0 bg-white/90 hover:bg-white text-foreground shadow-lg"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onEditClick(resource)
            }}
          >
            <Settings className="h-4 w-4" />
            <span className="sr-only">Edit resource</span>
          </Button>
        </div>

        {/* Year Badge */}
        {resource.year && (
          <div className="absolute bottom-3 right-3">
            <div className="px-2.5 py-1 rounded-full bg-black/70 text-white text-xs font-medium">
              {resource.year}
            </div>
          </div>
        )}

      </a>

      <CardContent className="p-3 pt-2">
        {/* Author */}
        {resource.author && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm mb-2">
            <User className="h-3.5 w-3.5" />
            <span>{resource.author}</span>
          </div>
        )}

        {/* Summary */}
        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 mb-3">
          {resource.summary}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5">
          {resource.tags.map((tag, index) => (
            <Badge
              key={tag}
              variant="secondary"
              className={cn(
                "cursor-pointer text-xs font-medium px-2 py-0.5 rounded-full transition-colors",
                tagColors[index % tagColors.length]
              )}
              onClick={(e) => {
                e.preventDefault()
                onTagClick(tag)
              }}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
