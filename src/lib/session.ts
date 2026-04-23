import { cookies } from 'next/headers'
import { decrypt } from '@/actions/auth'
import prisma from '@/lib/prisma'

export type SessionUser = { id: string; email: string; role: string }
export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN'

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

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUserFromCookies()
  if (!user) {
    throw new Error('Nicht angemeldet.')
  }
  return user
}

export function isAdminRole(role: string): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}

export function isSuperAdminRole(role: string): boolean {
  return role === 'SUPER_ADMIN'
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSessionUser()
  if (!isAdminRole(user.role)) {
    throw new Error('Keine Berechtigung.')
  }
  return user
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireSessionUser()
  if (!isSuperAdminRole(user.role)) {
    throw new Error('Keine Berechtigung.')
  }
  return user
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
