/**
 * App is hosted under /uxd on invite.illinois.edu (cPanel static export).
 * Keep in sync with next.config.mjs basePath.
 */
export const BASE_PATH = "/uxd"

/** Prefix a root-relative public asset path with the deployment basePath. */
export function withBasePath(path: string): string {
  if (!path) return path
  if (/^https?:\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path
  }
  const normalized = path.startsWith("/") ? path : `/${path}`
  if (normalized === BASE_PATH || normalized.startsWith(`${BASE_PATH}/`)) {
    return normalized
  }
  return `${BASE_PATH}${normalized}`
}
