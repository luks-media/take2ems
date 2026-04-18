import { cookies } from 'next/headers'
import { decrypt } from '@/actions/auth'
import prisma from '@/lib/prisma'

export type SessionUser = { id: string; email: string; role: string }

export type HeaderUserProfile = SessionUser & { name: string }

export async function getSessionUserFromCookies(): Promise<SessionUser | null> {
  const token = cookies().get('auth_session')?.value
  if (!token) return null
  try {
    const session = await decrypt(token)
    const u = session?.user
    if (!u || typeof u.id !== 'string' || typeof u.role !== 'string') {
      return null
    }
    return {
      id: u.id,
      email: typeof u.email === 'string' ? u.email : '',
      role: u.role,
    }
  } catch {
    return null
  }
}

export async function getHeaderUserProfile(): Promise<HeaderUserProfile | null> {
  const s = await getSessionUserFromCookies()
  if (!s) return null
  const row = await prisma.user.findUnique({
    where: { id: s.id },
    select: { id: true, name: true, email: true, role: true },
  })
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
  }
}
