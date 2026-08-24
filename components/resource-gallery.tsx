"use client"

import { ResourceCard } from "@/components/resource-card"
import type { Resource } from "@/lib/resources-data"
import { PackageOpen } from "lucide-react"

interface ResourceGalleryProps {
  resources: Resource[]
  onTagClick: (tag: string) => void
  onEditClick: (resource: Resource) => void
}

export function ResourceGallery({ resources, onTagClick, onEditClick }: ResourceGalleryProps) {
  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <PackageOpen className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">No resources found</h3>
        <p className="text-muted-foreground max-w-md">
          Try adjusting your search or filters to find what you&apos;re looking for.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {resources.map((resource) => (
        <ResourceCard 
          key={resource.id} 
          resource={resource} 
          onTagClick={onTagClick}
          onEditClick={onEditClick}
        />
      ))}
    </div>
  )
}
