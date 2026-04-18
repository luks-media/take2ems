import { join } from 'path'

/**
 * Resolves the on-disk path for a SQLite `DATABASE_URL` (file:…).
 * Paths are relative to the `prisma/` directory, matching Prisma’s SQLite URL rules.
 */
export function resolveSqliteDatabaseFilePath(): string | null {
  const raw = process.env.DATABASE_URL?.trim()
  if (!raw?.startsWith('file:')) return null

  const pathPart = raw.slice('file:'.length)
  if (pathPart.startsWith('/')) {
    return pathPart
  }

  const rel = pathPart.replace(/^\.\//, '')
  return join(process.cwd(), 'prisma', rel)
}
