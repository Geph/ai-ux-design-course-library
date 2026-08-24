"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Copy, Check, Quote } from "lucide-react"
import { generateApaCitation } from "@/lib/resource-utils"
import type { Resource } from "@/lib/resources-data"

interface CitationDialogProps {
  resource: Resource | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CitationDialog({ resource, open, onOpenChange }: CitationDialogProps) {
  const [copied, setCopied] = useState(false)

  if (!resource) return null

  const citation = generateApaCitation(resource)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(citation)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy citation:", err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Quote className="h-5 w-5 text-primary" />
            APA Citation
          </DialogTitle>
          <DialogDescription>
            Copy this citation to reference the resource in your work.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="relative">
            <div className="p-4 bg-muted rounded-lg border border-border">
              <p className="text-sm text-foreground leading-relaxed font-mono whitespace-pre-wrap">
                {citation}
              </p>
            </div>
          </div>

          <Button
            onClick={handleCopy}
            className="w-full gap-2"
            variant={copied ? "secondary" : "default"}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied to Clipboard
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Citation
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
