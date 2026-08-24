import fs from "fs"
import path from "path"

/**
 * pdf.js loads its worker from a URL at runtime. Copying the installed worker
 * into public/ keeps it version-matched with pdfjs-dist and avoids a CDN
 * dependency in the static export.
 */
const source = path.join("node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs")
const destination = path.join("public", "pdf.worker.min.mjs")

if (!fs.existsSync(source)) {
  console.warn(`pdf.js worker not found at ${source} - skipping copy.`)
  process.exit(0)
}

fs.copyFileSync(source, destination)
console.log(`Copied pdf.js worker to ${destination}`)
