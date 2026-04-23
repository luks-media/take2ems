import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const jwtSecret = process.env.JWT_SECRET?.trim()

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required')
}

const secretKey = new TextEncoder().encode(jwtSecret)
const publicPaths = new Set(['/login', '/favicon.ico', '/robots.txt', '/sitemap.xml'])
const publicFilePattern = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|txt|xml|woff2?|ttf|eot)$/i

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (
    publicPaths.has(path) ||
    path.startsWith('/api/') ||
    path.startsWith('/_next/') ||
    publicFilePattern.test(path)
  ) {
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
