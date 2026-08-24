"use client"

import React, { useRef, useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Settings, Download, Upload, Check, Sun, Moon, X, Trash2, FileJson, FilePlus2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  downloadTextFile,
  exportJsonFile,
  jsonToResources,
  parseResourcesJson,
  resourceTemplateJson,
  separateDuplicates,
} from "@/lib/json-utils"
import { colorPalettes, applyPalette, PALETTE_STORAGE_KEY, THEME_STORAGE_KEY, type ColorPalette } from "@/lib/color-palettes"
import type { Resource } from "@/lib/resources-data"
import { Badge } from "@/components/ui/badge"

const POPULAR_TAGS_STORAGE_KEY = "ux-ai-popular-tags"
const APP_NAME_STORAGE_KEY = "ux-ai-app-name"
const APP_DESCRIPTION_STORAGE_KEY = "ux-ai-app-description"

interface SettingsDialogProps {
  resources: Resource[]
  onImport: (resources: Resource[]) => void
  onAddResources?: (resources: Resource[]) => void
  onDeleteAllResources?: () => void
  onAppNameChange?: (name: string) => void
  onAppDescriptionChange?: (description: string) => void
  currentAppName?: string
  currentAppDescription?: string
}

export function SettingsDialog({ 
  resources, 
  onImport,
  onAddResources,
  onDeleteAllResources,
  onAppNameChange,
  onAppDescriptionChange,
  currentAppName = "User Experience Design with AI",
  currentAppDescription = "Explore a curated and reviewed collection of learning resources related to the intersection of UX design and artificial intelligence."
}: SettingsDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedPalette, setSelectedPalette] = useState<string>("vibrant-blue")
  const [isDark, setIsDark] = useState(false)
  const [customTags, setCustomTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const [appName, setAppName] = useState(currentAppName)
  const [appDescription, setAppDescription] = useState(currentAppDescription)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const jsonInputRef = useRef<HTMLInputElement>(null)

  // Load saved preferences on mount
  useEffect(() => {
    const savedPalette = localStorage.getItem(PALETTE_STORAGE_KEY)
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    const savedTags = localStorage.getItem(POPULAR_TAGS_STORAGE_KEY)
    
    if (savedPalette) {
      setSelectedPalette(savedPalette)
    }
    if (savedTheme) {
      setIsDark(savedTheme === "dark")
    }
    if (savedTags) {
      setCustomTags(JSON.parse(savedTags))
    }
    
    // Load app metadata
    const savedName = localStorage.getItem(APP_NAME_STORAGE_KEY)
    if (savedName) setAppName(savedName)
    
    const savedDescription = localStorage.getItem(APP_DESCRIPTION_STORAGE_KEY)
    if (savedDescription) {
      // Strip HTML tags to get clean text
      const cleanDescription = savedDescription.replace(/<[^>]*>/g, '')
      setAppDescription(cleanDescription)
    }
    
    // Apply saved palette
    const palette = colorPalettes.find(p => p.id === (savedPalette || "vibrant-blue"))
    if (palette) {
      applyPalette(palette, savedTheme === "dark")
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark")
      }
    }
  }, [])

  const handlePaletteChange = (paletteId: string) => {
    setSelectedPalette(paletteId)
    localStorage.setItem(PALETTE_STORAGE_KEY, paletteId)
    
    const palette = colorPalettes.find(p => p.id === paletteId)
    if (palette) {
      applyPalette(palette, isDark)
    }
  }

  const handleThemeToggle = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    localStorage.setItem(THEME_STORAGE_KEY, newIsDark ? "dark" : "light")
    
    if (newIsDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
    
    const palette = colorPalettes.find(p => p.id === selectedPalette)
    if (palette) {
      applyPalette(palette, newIsDark)
    }
  }

  const handleExport = async () => {
    await exportJsonFile(resources, `ux-ai-resources-${new Date().toISOString().split("T")[0]}.json`)
  }

  const handleSaveAsDefault = async () => {
    if (!confirm("This will download resources.json. Place it in /public/ (or replace the course default file) before rebuilding for deployment. Continue?")) {
      return
    }

    await exportJsonFile(resources, "resources.json")
    alert("resources.json downloaded! Place it in /public/ and rebuild for cPanel deployment.")
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const importedResources = jsonToResources(await file.text())
      onImport(importedResources)
      alert(`Successfully imported ${importedResources.length} resources!`)
    } catch (err) {
      console.error("Failed to import JSON:", err)
      alert("Failed to import JSON file. Please check the format.")
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDownloadJsonTemplate = () => {
    downloadTextFile(resourceTemplateJson(), "resource-template.json", "application/json;charset=utf-8")
  }

  /** Adds items from a JSON file to the library instead of replacing it. */
  const handleAddFromJsonChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const { resources: parsed, errors } = parseResourcesJson(await file.text())

      if (parsed.length === 0) {
        alert(
          errors.length > 0
            ? `No resources could be added:\n\n${errors.join("\n")}`
            : "No resources were found in that file."
        )
        return
      }

      const { additions, duplicates } = separateDuplicates(parsed, resources)
      if (additions.length > 0) {
        onAddResources?.(additions)
      }

      const lines = [`Added ${additions.length} resource${additions.length === 1 ? "" : "s"}.`]
      if (duplicates.length > 0) {
        lines.push(`Skipped ${duplicates.length} already in the library.`)
      }
      if (errors.length > 0) {
        lines.push("", "Warnings:", ...errors)
      }
      alert(lines.join("\n"))
    } catch (err) {
      console.error("Failed to import JSON:", err)
      alert("Failed to read that JSON file. Please check the format.")
    }

    if (jsonInputRef.current) {
      jsonInputRef.current.value = ""
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !customTags.includes(newTag.trim())) {
      const updated = [...customTags, newTag.trim()]
      setCustomTags(updated)
      localStorage.setItem(POPULAR_TAGS_STORAGE_KEY, JSON.stringify(updated))
      setNewTag("")
    }
  }

  const handleRemoveTag = (tag: string) => {
    const updated = customTags.filter(t => t !== tag)
    setCustomTags(updated)
    localStorage.setItem(POPULAR_TAGS_STORAGE_KEY, JSON.stringify(updated))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="bg-transparent">
          <Settings className="h-4 w-4" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize your library appearance and manage your data.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4 pr-4">
          {/* App Name */}
          <div className="space-y-3">
            <Label htmlFor="app-name" className="text-sm font-medium">Library Name</Label>
            <Input
              id="app-name"
              value={appName}
              onChange={(e) => {
                setAppName(e.target.value)
                onAppNameChange?.(e.target.value)
                localStorage.setItem(APP_NAME_STORAGE_KEY, e.target.value)
              }}
              placeholder="Enter library name"
            />
          </div>

          {/* App Description */}
          <div className="space-y-3">
            <Label htmlFor="app-description" className="text-sm font-medium">Library Description</Label>
            <textarea
              id="app-description"
              value={appDescription}
              onChange={(e) => {
                setAppDescription(e.target.value)
                onAppDescriptionChange?.(e.target.value)
                localStorage.setItem(APP_DESCRIPTION_STORAGE_KEY, e.target.value)
              }}
              placeholder="Enter library description"
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background resize-none"
              rows={3}
            />
          </div>

          {/* Color Palette Selection */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-sm font-medium">Color Palette</Label>
            <div className="grid grid-cols-2 gap-2">
              {colorPalettes.map((palette) => (
                <PaletteOption
                  key={palette.id}
                  palette={palette}
                  isSelected={selectedPalette === palette.id}
                  onClick={() => handlePaletteChange(palette.id)}
                />
              ))}
            </div>
          </div>

          {/* Import/Export Section */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-sm font-medium">Library JSON</Label>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Import JSON library file"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleImportClick} 
                className="flex-1 gap-2 bg-transparent"
              >
                <Upload className="h-4 w-4" />
                Import Library
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExport} 
                className="flex-1 gap-2 bg-transparent"
              >
                <Download className="h-4 w-4" />
                Export Library
              </Button>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSaveAsDefault} 
              className="w-full gap-2 bg-transparent"
            >
              <Check className="h-4 w-4" />
              Save as Default Resources
            </Button>
            <p className="text-xs text-muted-foreground">
              Import replaces the whole library. Export downloads resources.json for backup or deployment.
            </p>
          </div>

          {/* Add individual items via JSON */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-sm font-medium">Add Items from JSON</Label>
            <div className="flex gap-2">
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleAddFromJsonChange}
                className="hidden"
                aria-label="Add resources from JSON file"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadJsonTemplate}
                className="flex-1 gap-2 bg-transparent"
              >
                <FileJson className="h-4 w-4" />
                JSON Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => jsonInputRef.current?.click()}
                className="flex-1 gap-2 bg-transparent"
              >
                <FilePlus2 className="h-4 w-4" />
                Add from JSON
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Download the template, fill in one entry per resource, then add them to the
              current library. Items already in the library are skipped.
            </p>
          </div>

          {/* Delete All Resources */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-sm font-medium">Danger Zone</Label>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => {
                if (window.confirm("Are you sure you want to delete all resources? This action cannot be undone.")) {
                  onDeleteAllResources?.()
                  setOpen(false)
                }
              }}
              className="w-full gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete All Resources
            </Button>
            <p className="text-xs text-muted-foreground">
              Permanently delete all resources in the library.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface PaletteOptionProps {
  palette: ColorPalette
  isSelected: boolean
  onClick: () => void
}

function PaletteOption({ palette, isSelected, onClick }: PaletteOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-2 rounded-lg border-2 p-3 text-left transition-all hover:bg-muted/50",
        isSelected ? "border-primary bg-primary/5" : "border-border"
      )}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
      <div className="flex gap-1">
        {palette.preview.map((color, index) => (
          <div
            key={index}
            className="h-5 w-5 rounded-full border border-border/50"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <span className="text-xs font-medium">{palette.name}</span>
    </button>
  )
}
