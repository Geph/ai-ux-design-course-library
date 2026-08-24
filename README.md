# Course Knowledge Library

![Knowledge Library Preview](Screenshot.png)

A comprehensive web-based resource library for organizing, searching, and managing educational materials for the "User Experience Design with AI" studio course.

## Features

### Resource Management
- **Multiple Resource Types**: Support for PDFs, Videos, Links, and Graphics
- **Add Resources**: Drag-and-drop files (PDFs, images up to 30MB) or paste URLs
- **Auto-Metadata Scraping**: Automatically extracts title, summary, author, thumbnail, and duration from URLs (YouTube, Vimeo, web pages)
- **Smart Type Detection**: Automatically detects resource type based on URL patterns (academic sites, video platforms, design tools, etc.)
- **Edit & Delete**: Modify any resource's details or remove it from the library

### Search & Filtering
- **Full-Text Search**: Search across titles, summaries, authors, and tags
- **Type Filtering**: Filter by PDFs, Videos, Links, or Graphics with count badges
- **Tag Filtering**: Click popular tags to filter resources; multi-select supported
- **Clear Filters**: One-click to reset all active filters

### Tags System
- **Popular Tags**: The filter row shows only tags used by more than 5 resources, so it stays short as the library grows (see `POPULAR_TAG_MIN_REFERENCES` in `lib/resources-data.ts`)
- **All Tags**: Every tag remains available from the "All Tags" list when adding or editing a resource
- **Custom Tags**: Add your own tags when creating or editing resources
- **Tag Suggestions**: Auto-suggested tags based on content analysis when adding URLs

### Citations
- **APA Format**: Generate properly formatted APA citations for any resource
- **One-Click Copy**: Copy citations to clipboard instantly
- **Type-Aware**: Citations formatted appropriately for videos, PDFs, graphics, and web pages

### Data Management
- **XML Storage**: All resources and tags are saved in XML format
- **Export Library**: Download your entire library as `resources.xml`
- **Import Library**: Upload an XML file to replace the current library
- **JSON Template**: Download `resource-template.json`, fill in one entry per resource, and hand it to collaborators
- **Add from JSON**: Import a JSON file of *additional* items; they are appended to the library and anything already present is skipped
- **Persistent Storage**: Data automatically saved to browser localStorage

### Customization
- **6 Color Palettes**: Choose from Vibrant Blue, Coral Sunset, Forest Mint, Royal Purple, Ocean Teal, or Midnight Gold
- **Light/Dark Mode**: Toggle between light and dark themes
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## XML File Format

Resources are stored in the following XML structure:

\`\`\`xml
<?xml version="1.0" encoding="UTF-8"?>
<resourceLibrary>
  <metadata>
    <exportDate>2026-01-26T00:00:00.000Z</exportDate>
    <totalResources>10</totalResources>
    <course>User Experience Design with AI</course>
  </metadata>
  <resources>
    <resource>
      <id>unique-id-123</id>
      <title>Resource Title</title>
      <type>pdf|video|link|graphic</type>
      <url>https://example.com/resource</url>
      <thumbnail>https://example.com/image.jpg</thumbnail>
      <summary>Brief description of the resource</summary>
      <dateAdded>2026-01-26</dateAdded>
      <author>Author Name</author>
      <duration>12:34</duration>
      <pages>42</pages>
      <localPath>/uploads/file.pdf</localPath>
      <tags>
        <tag>User research</tag>
        <tag>Tutorial</tag>
      </tags>
    </resource>
  </resources>
</resourceLibrary>
\`\`\`

## Getting Started

1. **Add Resources**: Click the large "Add Resource" button to add PDFs, images, or URLs
2. **Organize with Tags**: Add relevant tags from the popular list or create custom ones
3. **Search & Filter**: Use the search bar and filter buttons to find specific resources
4. **Generate Citations**: Click "Cite" on any resource card for an APA-formatted citation
5. **Export Your Library**: Go to Settings (gear icon) to export your library as XML

## Building and Deploying

### Prerequisites

- Node.js 18+ or Bun
- npm, yarn, pnpm, or bun package manager

### Local Development

\`\`\`bash
# Clone the repository
git clone <your-repo-url>
cd knowledge-library

# Install dependencies
npm install
# or
bun install

# Run the development server
npm run dev
# or
bun dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Building for Production

\`\`\`bash
# Create a production build
npm run build

# The output will be in the `.next` folder (for Node.js deployment)
# or `out` folder (for static export)
\`\`\`

### Static Export (cPanel / invite.illinois.edu)

This project is configured for static hosting under `/uxd`:

\`\`\`js
// next.config.mjs
{
  output: 'export',
  basePath: '/uxd',
  trailingSlash: true,
}
\`\`\`

Build and upload:

\`\`\`bash
npm run build
\`\`\`

Upload the contents of the `out/` directory to the cPanel folder that serves `https://invite.illinois.edu/uxd/`.

Default resources are synced from `uxd-ai-resources.xml` into `lib/resources-data.ts` and `public/resources.xml`. To refresh them:

\`\`\`bash
node scripts/parse-xml-resources.mjs
\`\`\`

### URL Auto-Fill (metadata scraping)

A static export has no server routes, and browsers block direct cross-origin page
requests, so metadata lookup uses `public/scrape.php`, which is copied to
`out/scrape.php` on build and runs on cPanel's PHP.

After uploading, confirm it works by opening:

\`\`\`
https://invite.illinois.edu/uxd/scrape.php?url=https://www.nngroup.com/articles/synthetic-users/
\`\`\`

A JSON response with `title`, `author`, `summary`, `thumbnail`, and `year` means
auto-fill is fully functional (including YouTube descriptions and upload years).

If PHP is unavailable, the app automatically falls back to CORS-enabled services
(noembed for YouTube/Vimeo, microlink and r.jina.ai for pages), which cover
titles, authors, images, and publication years but not YouTube descriptions.

### Deploying to Other Platforms

**Netlify:**
\`\`\`bash
npm run build
# Upload the `out` folder to Netlify
\`\`\`

**Apache/Nginx (Self-hosted):**
1. Confirm `basePath` in `next.config.mjs` matches your subdirectory
2. Run `npm run build`
3. Copy the contents of the `out` folder to your web server's public directory
4. Ensure your server is configured to serve `index.html` for all routes

**GitHub Pages:**
1. Set `basePath` to `'/<repo-name>'`
2. Build and push the `out` folder to the `gh-pages` branch

## Technology Stack

- Next.js 16 with App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui Components
- localStorage for data persistence
