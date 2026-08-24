"use client"

import { useState, useMemo, useEffect } from "react"
import { Header } from "@/components/header"
import { SearchBar } from "@/components/search-bar"
import { SettingsDialog } from "@/components/settings-dialog"
import { TagFilter } from "@/components/tag-filter"
import { ResourceGallery } from "@/components/resource-gallery"
import { EditResourceDialog } from "@/components/edit-resource-dialog"
import {
  resources as initialResources,
  RESOURCES_DATA_VERSION,
  type Resource,
  type ResourceType,
  getPopularTags,
  getAllTags,
} from "@/lib/resources-data"
import { xmlToResources, resourcesToXml } from "@/lib/xml-utils"
import { colorPalettes, applyPalette, PALETTE_STORAGE_KEY, THEME_STORAGE_KEY } from "@/lib/color-palettes"
import { withBasePath } from "@/lib/base-path"
import { SlidersHorizontal, X, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import packageJson from "@/package.json"

const STORAGE_KEY = "ux-ai-resources"
const STORAGE_VERSION_KEY = "ux-ai-resources-version"
const APP_NAME_STORAGE_KEY = "ux-ai-app-name"
const APP_DESCRIPTION_STORAGE_KEY = "ux-ai-app-description"

const DEFAULT_APP_NAME = "User Experience Design with AI"
const DEFAULT_APP_DESCRIPTION =
  "Explore a curated and reviewed collection of learning resources related to the intersection of UX design and artificial intelligence."
const FOOTER_TEXT =
  'A resource library for <a href="https://courses.illinois.edu/schedule/terms/INFO/490" target="_blank" rel="noopener noreferrer">Informatics 490: User Experience Design with AI</a>, a course at the University of Illinois at Urbana-Champaign'

const APP_VERSION = `v${packageJson.version}`

export default function ResourceLibrary() {
  const [resources, setResources] = useState<Resource[]>(initialResources)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedType, setSelectedType] = useState<ResourceType | "all">("all")
  const [editResource, setEditResource] = useState<Resource | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [showPopularTags, setShowPopularTags] = useState(true)
  const [appName, setAppName] = useState(DEFAULT_APP_NAME)
  const [appDescription, setAppDescription] = useState(DEFAULT_APP_DESCRIPTION)

  useEffect(() => {
    const loadResources = async () => {
      let resourcesToUse = initialResources

      const savedName = localStorage.getItem(APP_NAME_STORAGE_KEY)
      if (savedName) setAppName(savedName)

      const savedDescription = localStorage.getItem(APP_DESCRIPTION_STORAGE_KEY)
      if (savedDescription) {
        const cleanDescription = savedDescription.replace(/<[^>]*>/g, "")
        setAppDescription(cleanDescription)
      }

      const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY)
      const stored = localStorage.getItem(STORAGE_KEY)

      if (storedVersion === RESOURCES_DATA_VERSION && stored) {
        try {
          const parsed = xmlToResources(stored)
          if (parsed.length > 0) {
            resourcesToUse = parsed
          }
        } catch (err) {
          console.error("Failed to load stored resources:", err)
        }
      } else {
        // Prefer bundled defaults (synced from uxd-ai-resources.xml), then optional public XML
        try {
          const response = await fetch(withBasePath("/resources.xml"))
          if (response.ok) {
            const xmlText = await response.text()
            const parsed = xmlToResources(xmlText)
            if (parsed.length > 0) {
              resourcesToUse = parsed
            }
          }
        } catch (err) {
          console.error("Failed to load resources.xml:", err)
        }
        localStorage.setItem(STORAGE_VERSION_KEY, RESOURCES_DATA_VERSION)
      }

      setResources(resourcesToUse)
    }

    loadResources()

    const savedPalette = localStorage.getItem(PALETTE_STORAGE_KEY)
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)

    const palette = colorPalettes.find((p) => p.id === (savedPalette || "ocean-teal"))
    if (palette) {
      applyPalette(palette, savedTheme === "dark")
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark")
      }
    }
  }, [])

  useEffect(() => {
    const xml = resourcesToXml(resources)
    localStorage.setItem(STORAGE_KEY, xml)
    localStorage.setItem(STORAGE_VERSION_KEY, RESOURCES_DATA_VERSION)
  }, [resources])

  const popularTags = useMemo(() => getPopularTags(resources), [resources])
  const allTags = useMemo(() => getAllTags(resources), [resources])

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch =
        searchQuery === "" ||
        resource.title.toLowerCase().includes(searchLower) ||
        resource.summary.toLowerCase().includes(searchLower) ||
        resource.tags.some((tag) => tag.toLowerCase().includes(searchLower)) ||
        (resource.author?.toLowerCase().includes(searchLower) ?? false)

      const matchesType = selectedType === "all" || resource.type === selectedType
      const matchesTags =
        selectedTags.length === 0 || selectedTags.some((tag) => resource.tags.includes(tag))

      return matchesSearch && matchesType && matchesTags
    })
  }, [resources, searchQuery, selectedTags, selectedType])

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const clearAllFilters = () => {
    setSearchQuery("")
    setSelectedTags([])
    setSelectedType("all")
  }

  const handleAddResource = (resource: Resource) => {
    setResources((prev) => [resource, ...prev])
  }

  const handleDeleteAllResources = () => {
    setResources([])
    localStorage.removeItem(STORAGE_KEY)
  }

  const handleImport = (importedResources: Resource[]) => {
    setResources(importedResources)
  }

  const handleAddResources = (newResources: Resource[]) => {
    setResources((prev) => [...newResources, ...prev])
  }

  const handleEditClick = (resource: Resource) => {
    setEditResource(resource)
    setEditDialogOpen(true)
  }

  const handleUpdateResource = (updatedResource: Resource) => {
    setResources((prev) =>
      prev.map((r) => (r.id === updatedResource.id ? updatedResource : r))
    )
  }

  const handleDeleteResource = (id: string) => {
    setResources((prev) => prev.filter((r) => r.id !== id))
  }

  const hasActiveFilters =
    searchQuery !== "" || selectedTags.length > 0 || selectedType !== "all"

  return (
    <div className="min-h-screen bg-background">
      <Header
        resources={resources}
        onAddResource={handleAddResource}
        onImport={handleImport}
        popularTags={popularTags}
        allTags={allTags}
        appName={appName}
        appDescription={appDescription}
        appVersion={APP_VERSION}
      />

      <section className="sticky top-0 z-40 bg-card border-b-2 border-border shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="flex-1 max-w-2xl">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>
            <SettingsDialog
              resources={resources}
              onImport={handleImport}
              onAddResources={handleAddResources}
              onDeleteAllResources={handleDeleteAllResources}
              onAppNameChange={setAppName}
              onAppDescriptionChange={setAppDescription}
              currentAppName={appName}
              currentAppDescription={appDescription}
            />
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setShowPopularTags(!showPopularTags)}
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Popular Tags</span>
              {showPopularTags ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {showPopularTags && (
              <TagFilter
                tags={popularTags}
                selectedTags={selectedTags}
                onTagToggle={handleTagToggle}
              />
            )}
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">
                Showing {filteredResources.length} of {resources.length} resources
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-primary hover:text-primary/80"
              >
                <X className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            </div>
          )}
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ResourceGallery
          resources={filteredResources}
          onTagClick={handleTagToggle}
          onEditClick={handleEditClick}
        />
      </main>

      <EditResourceDialog
        resource={editResource}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleUpdateResource}
        onDelete={handleDeleteResource}
        popularTags={popularTags}
        allTags={allTags}
      />

      <footer className="border-t border-border bg-card mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
            <div className="text-center md:text-left space-y-2">
              <p className="whitespace-nowrap">
                Curated collection of {resources.length} resources
              </p>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://informatics.ischool.illinois.edu/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                title="University of Illinois Informatics"
              >
                <img
                  src={withBasePath("/uiuc-block-i.png")}
                  alt="UIUC Block I"
                  className="h-6 w-6"
                />
              </a>
              <a
                href="https://github.com/Geph/v0-ai-ux-design-course"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                title="GitHub Repository"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
            </div>
          </div>
          <div className="border-t border-border mt-6 pt-4 text-center text-xs text-muted-foreground [&_a]:text-primary [&_a]:hover:underline">
            <div dangerouslySetInnerHTML={{ __html: FOOTER_TEXT }} />
          </div>
        </div>
      </footer>
    </div>
  )
}
