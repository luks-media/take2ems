/**
 * Base URL without trailing slash. Used for OAuth redirects and calendar event links.
 */
export function getAppOrigin(): string {
  const raw = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').trim()
  return raw.replace(/\/$/, '')
}
