import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAppOrigin } from '@/lib/app-origin'
import { requireAdmin } from '@/lib/session'
import { createOAuth2Client, getGcalStateCookieName, GCAL_SCOPES } from '@/lib/google-calendar/oauth'

export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.redirect(new URL('/login', getAppOrigin()))
  }

  try {
    const oauth2 = createOAuth2Client()
    const state = randomBytes(24).toString('hex')
    const cookieStore = cookies()
    cookieStore.set(getGcalStateCookieName(), state, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
      secure: process.env.NODE_ENV === 'production',
    })

    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GCAL_SCOPES,
      state,
    })
    return NextResponse.redirect(url)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'OAuth-Start fehlgeschlagen.'
    return NextResponse.redirect(new URL(`/settings?google=error&message=${encodeURIComponent(message)}`, getAppOrigin()))
  }
}
