import { google } from 'googleapis'
import { getAppOrigin } from '@/lib/app-origin'
import { decryptRefreshToken } from '@/lib/google-calendar/crypto'

export const GCAL_SCOPES = ['https://www.googleapis.com/auth/calendar.events']

const GCAL_STATE_COOKIE = 'gcal_oauth_state'

export function getGcalStateCookieName() {
  return GCAL_STATE_COOKIE
}

export function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET sind nicht gesetzt.')
  }
  const redirectUri = `${getAppOrigin()}/api/google-calendar/callback`
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export function getCalendarOAuth2FromRefreshToken(refreshTokenEnc: string) {
  const oauth2 = createOAuth2Client()
  const refresh_token = decryptRefreshToken(refreshTokenEnc)
  oauth2.setCredentials({ refresh_token })
  return oauth2
}
