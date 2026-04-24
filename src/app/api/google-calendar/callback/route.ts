import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/session'
import { encryptRefreshToken } from '@/lib/google-calendar/crypto'
import { createOAuth2Client, getGcalStateCookieName } from '@/lib/google-calendar/oauth'
import { getAppOrigin } from '@/lib/app-origin'

export async function GET(request: NextRequest) {
  const base = getAppOrigin()
  try {
    await requireAdmin()
  } catch {
    return NextResponse.redirect(new URL('/login', base))
  }

  const cookieStore = cookies()
  const expectedState = cookieStore.get(getGcalStateCookieName())?.value
  cookieStore.set(getGcalStateCookieName(), '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  const url = request.nextUrl
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const oauthError = url.searchParams.get('error')

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/settings?google=error&message=${encodeURIComponent(oauthError)}`, base)
    )
  }

  if (!expectedState || !state || expectedState !== state) {
    return NextResponse.redirect(
      new URL(`/settings?google=error&message=${encodeURIComponent('Ungültiger OAuth-State.')}`, base)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`/settings?google=error&message=${encodeURIComponent('Kein Autorisierungscode.')}`, base)
    )
  }

  try {
    const oauth2 = createOAuth2Client()
    const { tokens } = await oauth2.getToken(code)
    const refresh = tokens.refresh_token
    if (!refresh) {
      return NextResponse.redirect(
        new URL(
          `/settings?google=error&message=${encodeURIComponent('Kein Refresh-Token. Bitte erneut verbinden und Zugriff gewaehren.')}`,
          base
        )
      )
    }

    const enc = encryptRefreshToken(refresh)
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        googleCalendarRefreshTokenEnc: enc,
      },
      update: {
        googleCalendarRefreshTokenEnc: enc,
      },
    })

    return NextResponse.redirect(new URL('/settings?google=connected', base))
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Token-Austausch fehlgeschlagen.'
    return NextResponse.redirect(new URL(`/settings?google=error&message=${encodeURIComponent(message)}`, base))
  }
}
