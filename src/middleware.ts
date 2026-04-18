import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-key-replace-me-in-production')

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (path === '/login' || path.startsWith('/api/') || path.startsWith('/_next/') || path.includes('.')) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get('auth_session')?.value

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await jwtVerify(sessionCookie, secretKey, {
      algorithms: ['HS256'],
    })
    return NextResponse.next()
  } catch (error) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
