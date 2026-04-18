import { isAppUrlConfigured } from '@/lib/mail'

export function getGoogleCalendarEnvSummary() {
  const id = process.env.GOOGLE_CLIENT_ID?.trim()
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  return {
    clientConfigured: Boolean(id && secret),
    tokenSecretReady: (process.env.GOOGLE_TOKEN_SECRET || process.env.JWT_SECRET || '').trim().length >= 16,
    appUrlReady: isAppUrlConfigured(),
  }
}
