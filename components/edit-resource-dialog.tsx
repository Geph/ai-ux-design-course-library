"use client"

import React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Save, Trash2, FileText, Video, Globe, X, Plus, ImageIcon, Camera, Loader2, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { scrapeUrlMetadata } from "@/lib/scrape-url"
import { withBasePath } from "@/lib/base-path"
import type { Resource, ResourceType, TagWithCount } from "@/lib/resources-data"

interface EditResourceDialogProps {
  resource: Resource | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (resource: Resource) => void
  onDelete: (id: string) => void
  popularTags: TagWithCount[]
  allTags: TagWithCount[]
}

export function EditResourceDialog({ 
  resource, 
  open, 
  onOpenChange, 
  onSave, 
  onDelete,
  popularTags,
  allTags 
}: EditResourceDialogProps) {
  const [title, setTitle] = useState("")
  const [showAllTags, setShowAllTags] = useState(false)
  const [author, setAuthor] = useState("")
  const [summary, setSummary] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const [thumbnail, setThumbnail] = useState("")
  const [year, setYear] = useState("")
  const [url, setUrl] = useState("")
  const [type, setType] = useState<ResourceType>("link")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false)

  useEffect(() => {
    if (resource) {
      setTitle(resource.title)
      setAuthor(resource.author || "")
      setSummary(resource.summary)
      setTags(resource.tags)
      setThumbnail(resource.thumbnail)
      setYear(resource.year?.toString() || "")
      setUrl(resource.url)
      setType(resource.type)
      setShowDeleteConfirm(false)
      setShowAllTags(false)
    }
  }, [resource])

  const formatTag = (tag: string): string => {
    const trimmed = tag.trim()
    
    // If the tag is all uppercase (like "RAG" or "AI"), keep it as-is
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 1) {
      return trimmed
    }
    
    // Otherwise, convert to title case (capitalize first letter of each word)
    return trimmed
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  const handleAddTag = (tag: string) => {
    const formatted = formatTag(tag)
    if (formatted && !tags.includes(formatted)) {
      setTags([...tags, formatted])
    }
    setNewTag("")
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTag.trim()) {
      e.preventDefault()
      handleAddTag(newTag)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!resource) return

    const updatedResource: Resource = {
      ...resource,
      title: title || "Untitled Resource",
      author: author ? author.slice(0, 160) : undefined,
      summary: summary || "No description provided.",
      tags,
      thumbnail: thumbnail || resource.thumbnail,
      year: year ? parseInt(year, 10) : undefined,
      url: url || resource.url,
      type,
    }

    onSave(updatedResource)
    onOpenChange(false)
  }

  const handleDelete = () => {
    if (resource) {
      onDelete(resource.id)
      onOpenChange(false)
    }
  }

  /** Refreshes the thumbnail and fills in any fields still blank. */
  const scrapeUrl = async (urlToScrape: string) => {
    if (!urlToScrape) return

    setIsGeneratingThumbnail(true)

    try {
      const data = await scrapeUrlMetadata(urlToScrape)

      if (data.thumbnail) setThumbnail(data.thumbnail)
      if (data.title) setTitle((previous) => previous.trim() || data.title)
      if (data.author) setAuthor((previous) => previous.trim() || data.author)
      if (data.summary) setSummary((previous) => previous.trim() || data.summary)
      if (data.year) setYear((previous) => previous.trim() || String(data.year))
    } catch (error) {
      console.error("Failed to fetch metadata:", error)
    } finally {
      setIsGeneratingThumbnail(false)
    }
  }

  const useGenericPdfThumbnail = () => {
    setThumbnail("/pdf-thumbnail.jpg")
  }

  const useGenericUrlThumbnail = () => {
    setThumbnail("/url-thumbnail.jpg")
  }

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return

    setIsGeneratingThumbnail(true)

    try {
      const img = new Image()
      const reader = new FileReader()

      reader.onload = (event) => {
        if (!event.target?.result) return
        img.src = event.target.result as string
      }

      img.onload = () => {
        // Target dimensions: 1200x800 (3:2 aspect ratio)
        const targetWidth = 1200
        const targetHeight = 800
        const targetAspect = targetWidth / targetHeight

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = targetWidth
        canvas.height = targetHeight

        // Calculate dimensions to maintain aspect ratio with crop
        const imgAspect = img.width / img.height
        let drawWidth, drawHeight, offsetX, offsetY

        if (imgAspect > targetAspect) {
          // Image is wider - fit height and crop width
          drawHeight = img.height
          drawWidth = img.height * targetAspect
          offsetX = (img.width - drawWidth) / 2
          offsetY = 0
        } else {
          // Image is taller - fit width and crop height
          drawWidth = img.width
          drawHeight = img.width / targetAspect
          offsetX = 0
          offsetY = (img.height - drawHeight) / 2
        }

        // Draw cropped and scaled image
        ctx.drawImage(
          img,
          offsetX, offsetY, drawWidth, drawHeight,
          0, 0, targetWidth, targetHeight
        )

        const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setThumbnail(thumbnailDataUrl)
        setIsGeneratingThumbnail(false)
      }

      reader.readAsDataURL(file)
    } catch (error) {
      console.error("Failed to process thumbnail:", error)
      setIsGeneratingThumbnail(false)
    }
  }

  const suggestedTags = popularTags.filter(t => !tags.includes(t.tag))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Resource</DialogTitle>
          <DialogDescription>
            Update the details for this resource or delete it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Resource title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-url">URL</Label>
            <Input
              id="edit-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-author">Author/Organization</Label>
            <Input
              id="edit-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value.slice(0, 160))}
              placeholder="Author or organization name"
              maxLength={160}
            />
            <p className="text-xs text-muted-foreground text-right">{author.length}/160</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ResourceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" /> PDF
                  </span>
                </SelectItem>
                <SelectItem value="video">
                  <span className="flex items-center gap-2">
                    <Video className="h-4 w-4" /> Video
                  </span>
                </SelectItem>
                <SelectItem value="link">
                  <span className="flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Link
                  </span>
                </SelectItem>
                <SelectItem value="graphic">
                  <span className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" /> Graphic
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Year field for all resource types */}
          <div className="space-y-2">
            <Label htmlFor="edit-year">Year</Label>
            <Input
              id="edit-year"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g., 2024"
              min={1900}
              max={2100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-summary">Summary / Abstract</Label>
            <Textarea
              id="edit-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief description of the resource..."
              rows={3}
            />
          </div>

          {/* Tags Section */}
          <div className="space-y-3">
            <Label>Tags</Label>
            
            {/* Current Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="px-2 py-1 text-xs gap-1"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add New Tag */}
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a tag and press Enter"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddTag(newTag)}
                disabled={!newTag.trim()}
                className="bg-transparent"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Suggested Tags */}
            {suggestedTags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Popular tags:</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllTags(!showAllTags)}
                    className="h-6 text-xs px-2"
                  >
                    {showAllTags ? "Show Less" : "All Tags"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(showAllTags 
                    ? allTags.filter(t => !tags.includes(t.tag))
                    : suggestedTags.slice(0, 6)
                  ).map((tagObj) => (
                    <Badge
                      key={tagObj.tag}
                      variant="outline"
                      className="cursor-pointer text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => handleAddTag(tagObj.tag)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {tagObj.tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-thumbnail">Thumbnail URL (optional)</Label>
            <Input
              id="edit-thumbnail"
              type="url"
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              placeholder="https://... or leave blank"
            />
            <p className="text-xs text-muted-foreground">Ideal size: 1200×800px (3:2 ratio). Images will be auto-cropped to fit.</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('edit-thumbnail-upload')?.click()}
                disabled={isGeneratingThumbnail}
                className="bg-transparent"
              >
                {isGeneratingThumbnail ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3 mr-1" />
                    Upload
                  </>
                )}
              </Button>
              <input
                id="edit-thumbnail-upload"
                type="file"
                accept="image/*"
                onChange={handleThumbnailUpload}
                className="hidden"
              />
              {url && /^https?:\/\//i.test(url) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => scrapeUrl(url)}
                  disabled={isGeneratingThumbnail}
                  className="bg-transparent"
                >
                  {isGeneratingThumbnail ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Camera className="h-3 w-3 mr-1" />
                      Fetch Metadata
                    </>
                  )}
                </Button>
              )}
              {type === 'pdf' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={useGenericPdfThumbnail}
                  className="bg-transparent"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Generic PDF
                </Button>
              )}
              {url && type !== 'video' && type !== 'pdf' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={useGenericUrlThumbnail}
                  className="bg-transparent"
                >
                  <Globe className="h-3 w-3 mr-1" />
                  Generic URL
                </Button>
              )}
            </div>
            {thumbnail && (
              <div className="mt-2 border rounded-lg overflow-hidden">
                <img src={withBasePath(thumbnail)} alt="Thumbnail preview" className="w-full h-32 object-cover" />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t">
            {!showDeleteConfirm ? (
              <>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground bg-transparent"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                <Button type="submit" className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <div className="flex-1 space-y-3">
                <p className="text-sm text-destructive font-medium">
                  Are you sure you want to delete this resource?
                </p>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 bg-transparent"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    variant="destructive"
                    onClick={handleDelete}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Confirm Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
