/**
 * Deployment base path.
 * - cPanel (invite.illinois.edu): `/uxd` (default)
 * - GitHub Pages: `/{repo}` set via NEXT_PUBLIC_BASE_PATH at build time
 * Keep in sync with next.config.mjs.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/uxd"

/** Prefix a root-relative public asset path with the deployment basePath. */
export function withBasePath(path: string): string {
  if (!path) return path
  if (/^https?:\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path
  }
  const normalized = path.startsWith("/") ? path : `/${path}`
  if (!BASE_PATH || BASE_PATH === "/") {
    return normalized
  }
  if (normalized === BASE_PATH || normalized.startsWith(`${BASE_PATH}/`)) {
    return normalized
  }
  return `${BASE_PATH}${normalized}`
}
