/**
 * Patch-bump package.json (and package-lock.json) version.
 * Used by GitHub Actions before Pages deploy.
 * Usage: node scripts/bump-version.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pkgPath = path.join(root, "package.json")
const lockPath = path.join(root, "package-lock.json")
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))

const parts = String(pkg.version)
  .split(".")
  .map((n) => Number.parseInt(n, 10))

if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
  console.error(`Invalid version in package.json: ${pkg.version}`)
  process.exit(1)
}

parts[2] += 1
pkg.version = parts.join(".")
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"))
  lock.version = pkg.version
  if (lock.packages?.[""]) {
    lock.packages[""].version = pkg.version
  }
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
}

console.log(pkg.version)
