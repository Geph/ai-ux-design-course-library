"use client"

import { Badge } from "@/components/ui/badge"
import { ImageIcon } from "lucide-react"

import React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Upload, Link as LinkIcon, FileText, Video, Globe, X, AlertCircle, Loader2, Sparkles, Camera } from "lucide-react"
import { cn } from "@/lib/utils"
import { detectResourceType, generateId } from "@/lib/resource-utils"
import { scrapeUrlMetadata } from "@/lib/scrape-url"
import { withBasePath } from "@/lib/base-path"
import type { Resource, ResourceType, TagWithCount } from "@/lib/resources-data"

const MAX_FILE_SIZE = 30 * 1024 * 1024 // 30MB in bytes

interface AddResourceDialogProps {
  onAddResource: (resource: Resource) => void
  popularTags: TagWithCount[]
  allTags: TagWithCount[]
  existingResources?: Resource[]
}

export function AddResourceDialog({ onAddResource, popularTags, allTags, existingResources = [] }: AddResourceDialogProps) {
  const [open, setOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showAllTags, setShowAllTags] = useState(false)
  const [url, setUrl] = useState("")
  const [detectedType, setDetectedType] = useState<ResourceType>("link")
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [summary, setSummary] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const [thumbnail, setThumbnail] = useState("")
  const [year, setYear] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isScrapingUrl, setIsScrapingUrl] = useState(false)
  const [scrapedSuccessfully, setScrapedSuccessfully] = useState(false)
  const [scrapeFailed, setScrapeFailed] = useState(false)
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<Resource | null>(null)
  const lastScrapedUrl = useRef<string | null>(null)

  const resetForm = () => {
    setUrl("")
    setDetectedType("link")
    setTitle("")
    setAuthor("")
    setSummary("")
    setTags([])
    setNewTag("")
    setThumbnail("")
    setYear("")
    setShowForm(false)
    setUploadedFile(null)
    setFileError(null)
    setIsScrapingUrl(false)
    setScrapedSuccessfully(false)
    setScrapeFailed(false)
    setIsGeneratingThumbnail(false)
    setDuplicateWarning(null)
    setShowAllTags(false)
    lastScrapedUrl.current = null
  }

  const checkForDuplicates = (checkTitle: string, checkUrl: string): Resource | null => {
    if (!checkTitle && !checkUrl) return null
    
    const titleLower = checkTitle.toLowerCase().trim()
    const urlNormalized = checkUrl.toLowerCase().trim()
    
    return existingResources.find(resource => {
      const existingTitleLower = resource.title.toLowerCase().trim()
      const existingUrlNormalized = resource.url.toLowerCase().trim()
      
      // Check for exact title match or exact URL match
      return (titleLower && titleLower === existingTitleLower) || 
             (urlNormalized && urlNormalized === existingUrlNormalized && urlNormalized !== "#")
    }) || null
  }

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

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTag.trim()) {
      e.preventDefault()
      handleAddTag(newTag)
    }
  }

  /** `force` (manual refresh) overwrites existing values; auto-runs only fill blanks. */
  const scrapeUrl = async (urlToScrape: string, force = false) => {
    if (!urlToScrape) return

    lastScrapedUrl.current = urlToScrape
    setIsScrapingUrl(true)
    setScrapedSuccessfully(false)
    setScrapeFailed(false)

    try {
      const data = await scrapeUrlMetadata(urlToScrape)
      const fill = (value: string) => (previous: string) =>
        force || !previous.trim() ? value : previous

      if (data.title) setTitle(fill(data.title))
      if (data.author) setAuthor(fill(data.author))
      if (data.summary) setSummary(fill(data.summary))
      if (data.thumbnail) setThumbnail(fill(data.thumbnail))
      if (data.year) setYear(fill(data.year.toString()))
      if (data.type) setDetectedType(data.type)

      if (data.suggestedTags.length > 0) {
        setTags((prevTags) => {
          const newTags = [...prevTags]
          for (const tag of data.suggestedTags) {
            const formatted = formatTag(tag)
            if (!newTags.includes(formatted)) {
              newTags.push(formatted)
            }
          }
          return newTags
        })
      }

      setScrapedSuccessfully(data.found)
      setScrapeFailed(!data.found)
    } catch {
      setScrapeFailed(true)
    } finally {
      setIsScrapingUrl(false)
    }
  }

  const handleUrlChange = (value: string) => {
    setUrl(value)
    setUploadedFile(null)
    setFileError(null)
    setScrapedSuccessfully(false)
    setScrapeFailed(false)
    if (value) {
      const type = detectResourceType(value)
      setDetectedType(type)
      setShowForm(true)
    }
  }

  // Auto-fetch shortly after a complete URL is typed or pasted.
  useEffect(() => {
    if (uploadedFile) return
    const candidate = url.trim()
    if (!/^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(candidate)) return
    if (lastScrapedUrl.current === candidate) return

    const timer = setTimeout(() => {
      scrapeUrl(candidate)
    }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, uploadedFile])

  const handleUrlBlur = () => {
    const candidate = url.trim()
    if (candidate && !isScrapingUrl && lastScrapedUrl.current !== candidate) {
      scrapeUrl(candidate)
    }
  }

  const generateThumbnail = async () => {
    if (!url && !uploadedFile) return
    
    setIsGeneratingThumbnail(true)
    
    try {
      // For uploaded files (images), create a preview from the file
      if (uploadedFile && uploadedFile.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          if (e.target?.result) {
            setThumbnail(e.target.result as string)
          }
        }
        reader.readAsDataURL(uploadedFile)
      }
      // For uploaded PDFs, generate thumbnail from first page
      else if (uploadedFile && uploadedFile.type === 'application/pdf') {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = withBasePath('/pdf.worker.min.mjs')
        
        const arrayBuffer = await uploadedFile.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const page = await pdf.getPage(1)
        
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        
        if (context) {
          canvas.height = viewport.height
          canvas.width = viewport.width
          
          await page.render({
            canvas,
            canvasContext: context,
            viewport,
          }).promise
          
          const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8)
          setThumbnail(thumbnailDataUrl)
        }
      }
      // For URL-based resources (not YouTube - those get scraped automatically)
      else if (url && !url.startsWith('file://') && detectedType !== 'video') {
        const thumbnailUrl = `https://image.thum.io/get/width/1200/crop/800/${encodeURIComponent(url)}`
        setThumbnail(thumbnailUrl)
      }
    } catch (error) {
      console.error("Failed to generate thumbnail:", error)
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

  const handleFileUpload = (file: File) => {
    setFileError(null)
    
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File size exceeds 30MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`)
      return
    }

    const imageTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml"]

  if (file.type === "application/pdf") {
    // Show warning about temporary storage
    const proceed = window.confirm(
      "⚠️ Uploaded PDFs are temporary and local only.\n\n" +
      "They will not be saved when you refresh the page or export your library.\n\n" +
      "For permanent storage, we recommend hosting PDFs elsewhere (Google Drive, Dropbox, etc.) and using a link instead.\n\n" +
      "Continue with temporary upload?"
    )
    if (!proceed) return
    
    setUploadedFile(file)
    setDetectedType("pdf")
    setTitle(file.name.replace(".pdf", ""))
    setUrl("") // Clear URL since we're using a file
    setShowForm(true)
  } else if (imageTypes.includes(file.type)) {
      setUploadedFile(file)
      setDetectedType("graphic")
      // Remove file extension from title
      const nameWithoutExt = file.name.replace(/\.(png|jpg|jpeg|gif|webp|svg)$/i, "")
      setTitle(nameWithoutExt)
      setUrl("") // Clear URL since we're using a file
      setShowForm(true)
    } else {
      setFileError("Supported files: PDF and images (PNG, JPG, GIF, WebP, SVG). For videos and links, please use a URL.")
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setFileError(null)

    // Check for URL drop
    const text = e.dataTransfer.getData("text/plain")
    if (text && (text.startsWith("http://") || text.startsWith("https://"))) {
      handleUrlChange(text)
      return
    }

    // Check for file drop
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain")
    if (text && (text.startsWith("http://") || text.startsWith("https://"))) {
      e.preventDefault()
      handleUrlChange(text)
    }
  }, [])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check for duplicates first
    const resourceUrl = url || "#"
    const duplicate = checkForDuplicates(title, resourceUrl)
    
    if (duplicate) {
      setDuplicateWarning(duplicate)
      return
    }

  let localPath: string | undefined
  let finalResourceUrl = resourceUrl
  
  // If a file was uploaded, create a blob URL (temporary, local only)
  if (uploadedFile) {
    localPath = URL.createObjectURL(uploadedFile)
    finalResourceUrl = localPath
  }
  
  const resource: Resource = {
    id: generateId(),
    title: title || "Untitled Resource",
    type: detectedType,
    url: finalResourceUrl,
    thumbnail: thumbnail || `https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=300&fit=crop`,
    summary: summary || "No description provided.",
    tags: tags,
    dateAdded: new Date().toISOString().split("T")[0],
    author: author ? author.slice(0, 160) : undefined,
    year: year ? parseInt(year, 10) : undefined,
    localPath: localPath,
  }

    onAddResource(resource)
    resetForm()
    setOpen(false)
  }

  const handleProceedWithDuplicate = () => {
    let localPath: string | undefined
    let finalResourceUrl = url || "#"
    
    // If a file was uploaded, create a blob URL
    if (uploadedFile) {
      localPath = URL.createObjectURL(uploadedFile)
      finalResourceUrl = localPath
    }
    
    const resource: Resource = {
      id: generateId(),
      title: title || "Untitled Resource",
      type: detectedType,
      url: finalResourceUrl,
      thumbnail: thumbnail || `https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=300&fit=crop`,
      summary: summary || "No description provided.",
      tags: tags,
      dateAdded: new Date().toISOString().split("T")[0],
      author: author ? author.slice(0, 160) : undefined,
      year: year ? parseInt(year, 10) : undefined,
      localPath: localPath,
    }
  
  setDuplicateWarning(null)
  onAddResource(resource)
  resetForm()
  setOpen(false)
  }

  const typeIcons: Record<ResourceType, typeof FileText> = {
    pdf: FileText,
    video: Video,
    link: Globe,
    graphic: ImageIcon,
  }

  const TypeIcon = typeIcons[detectedType]

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm() }}>
      <DialogTrigger asChild>
        <Button 
          size="lg"
          className="gap-3 px-8 py-6 text-lg font-semibold bg-gradient-to-r from-primary via-[oklch(0.60_0.20_330)] to-accent hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 rounded-xl"
        >
          <Plus className="h-6 w-6" />
          Add Resource
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Resource</DialogTitle>
          <DialogDescription>
            Add a URL or drop a PDF file (max 30MB) to add a new learning resource.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onPaste={handlePaste}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition-all",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                isDragging ? "bg-primary/20" : "bg-muted"
              )}>
                <Upload className={cn(
                  "h-6 w-6 transition-colors",
                  isDragging ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  Drop a file or URL here
                </p>
                <p className="text-sm text-muted-foreground">
                  PDFs and images up to 30MB, or paste a link below
                </p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <span className="text-sm text-primary hover:underline">
                  Browse files
                </span>
              </label>
            </div>
          </div>

          {/* File Error */}
          {fileError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{fileError}</span>
            </div>
          )}

          {/* Uploaded File Indicator */}
          {uploadedFile && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <FileText className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{uploadedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUploadedFile(null)
                  setShowForm(false)
                }}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* URL Input */}
          {!uploadedFile && (
            <div className="space-y-2">
              <Label htmlFor="url">Resource URL</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://..."
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    onBlur={handleUrlBlur}
                    className="pl-10"
                  />
                </div>
                {url && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => scrapeUrl(url, true)}
                    disabled={isScrapingUrl}
                    className="bg-transparent shrink-0"
                    title="Auto-fetch metadata"
                  >
                    {isScrapingUrl ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              {isScrapingUrl && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Fetching metadata...
                </p>
              )}
              {scrapedSuccessfully && !isScrapingUrl && (
                <p className="text-xs text-primary flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Metadata auto-filled from URL
                </p>
              )}
              {scrapeFailed && !isScrapingUrl && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3" />
                  This site blocked automatic lookup — please fill in the details below.
                </p>
              )}
              {url && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Detected type:</span>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                    detectedType === "pdf" && "bg-[oklch(0.60_0.22_25)]/10 text-[oklch(0.60_0.22_25)]",
                    detectedType === "video" && "bg-[oklch(0.60_0.20_330)]/10 text-[oklch(0.60_0.20_330)]",
                    detectedType === "link" && "bg-[oklch(0.55_0.22_250)]/10 text-[oklch(0.55_0.22_250)]",
                    detectedType === "graphic" && "bg-[oklch(0.70_0.18_145)]/10 text-[oklch(0.70_0.18_145)]"
                  )}>
                    <TypeIcon className="h-3 w-3" />
                    {detectedType.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Detailed Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Resource title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="author">Author/Organization</Label>
                <Input
                  id="author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value.slice(0, 160))}
                  placeholder="Author or organization name"
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground text-right">{author.length}/160</p>
              </div>

              {!uploadedFile && (
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={detectedType} onValueChange={(v) => setDetectedType(v as ResourceType)}>
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
              )}

              {/* Year field for all resource types */}
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g., 2024"
                  min={1900}
                  max={2100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary / Abstract</Label>
                <Textarea
                  id="summary"
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
                    onKeyDown={handleTagKeyDown}
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
              {popularTags.filter(t => !tags.includes(t.tag)).length > 0 && (
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
                      : popularTags.filter(t => !tags.includes(t.tag)).slice(0, 6)
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
            <Label>Thumbnail (optional)</Label>
            <p className="text-xs text-muted-foreground">Ideal size: 1200×800px (3:2 ratio). Images will be auto-cropped to fit.</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('thumbnail-upload')?.click()}
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
                id="thumbnail-upload"
                type="file"
                accept="image/*"
                onChange={handleThumbnailUpload}
                className="hidden"
              />
              {(url || uploadedFile) && detectedType !== 'video' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateThumbnail}
                  disabled={isGeneratingThumbnail}
                  className="bg-transparent"
                >
                  {isGeneratingThumbnail ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Camera className="h-3 w-3 mr-1" />
                      Screenshot
                    </>
                  )}
                </Button>
              )}
              {url && detectedType === 'video' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => scrapeUrl(url, true)}
                  disabled={isScrapingUrl}
                  className="bg-transparent"
                >
                  {isScrapingUrl ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Camera className="h-3 w-3 mr-1" />
                      Regenerate
                    </>
                  )}
                </Button>
              )}
              {(uploadedFile?.type === 'application/pdf' || detectedType === 'pdf') && (
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
              {url && !uploadedFile && detectedType !== 'video' && (
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

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1 bg-transparent">
                  <X className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Button type="submit" className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Resource
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Duplicate Warning Dialog */}
        {duplicateWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card rounded-lg shadow-xl max-w-md mx-4 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Duplicate Resource Detected</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    A resource with the title "{duplicateWarning.title}" already exists in your library. 
                  </p>
                </div>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="font-medium text-foreground">Existing Resource:</div>
                <div className="text-muted-foreground">{duplicateWarning.title}</div>
                {duplicateWarning.url && duplicateWarning.url !== "#" && (
                  <div className="text-xs text-muted-foreground truncate mt-2">{duplicateWarning.url}</div>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Do you want to add it anyway? You will end up with two copies in the library.
              </p>

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setDuplicateWarning(null)}
                  className="flex-1 bg-transparent"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleProceedWithDuplicate}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  Add Anyway
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
