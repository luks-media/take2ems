'use server'

import prisma from '@/lib/prisma'
import { normalizeEmail } from '@/lib/email'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import {
  isAdminRole,
  isSuperAdminRole,
  requireAdmin,
  requireSessionUser,
} from '@/lib/session'

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  locations: true,
  equipment: {
    include: {
      location: true,
      owners: {
        select: {
          id: true,
        },
      },
    },
    orderBy: { name: 'asc' as const },
  },
}

export async function getUsers() {
  await requireSessionUser()

  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: userSelect,
  })
}

export async function getUserById(id: string) {
  await requireSessionUser()

  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      rentals: true,
    },
  })
}

export async function createUser(data: { name: string, email: string, password?: string, role: string }) {
  const actor = await requireAdmin()

  if (data.role !== 'USER' && data.role !== 'ADMIN' && data.role !== 'SUPER_ADMIN') {
    throw new Error('Ungültige Rolle.')
  }
  if (data.role !== 'USER' && !isSuperAdminRole(actor.role)) {
    throw new Error('Nur Super-Admins dürfen privilegierte Rollen vergeben.')
  }

  const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : undefined
  const email = normalizeEmail(data.email)

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email,
      password: hashedPassword,
      role: data.role,
    }
  })

  revalidatePath('/users')
  return user
}

export async function updateUser(
  id: string,
  data: {
    name: string
    email: string
    role: string
    password?: string
  }
) {
  const actor = await requireAdmin()

  if (data.role !== 'ADMIN' && data.role !== 'USER' && data.role !== 'SUPER_ADMIN') {
    throw new Error('Ungültige Rolle.')
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  })
  if (!existing) {
    throw new Error('Benutzer nicht gefunden.')
  }

  const actorIsSuperAdmin = isSuperAdminRole(actor.role)
  const existingIsSuperAdmin = isSuperAdminRole(existing.role)
  const changingRole = existing.role !== data.role

  if (existingIsSuperAdmin && !actorIsSuperAdmin) {
    throw new Error('Nur Super-Admins dürfen Super-Admins verwalten.')
  }

  if (isAdminRole(existing.role) && !actorIsSuperAdmin) {
    throw new Error('Nur Super-Admins dürfen Admin-Konten verwalten.')
  }

  if (changingRole && !actorIsSuperAdmin) {
    throw new Error('Nur Super-Admins dürfen Rollen ändern.')
  }

  if (existingIsSuperAdmin && data.role !== 'SUPER_ADMIN') {
    const superAdminCount = await prisma.user.count({ where: { role: 'SUPER_ADMIN' } })
    if (superAdminCount <= 1) {
      throw new Error('Der letzte Super-Admin kann nicht degradiert werden.')
    }
  }

  if (
    isAdminRole(existing.role) &&
    !isAdminRole(data.role)
  ) {
    const adminLikeCount = await prisma.user.count({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    })
    if (adminLikeCount <= 1) {
      throw new Error('Der letzte Admin kann nicht zu User degradiert werden.')
    }
  }

  const payload: {
    name: string
    email: string
    role: string
    password?: string
  } = {
    name: data.name,
    email: normalizeEmail(data.email),
    role: data.role,
  }

  if (data.password && data.password.trim().length > 0) {
    payload.password = await bcrypt.hash(data.password.trim(), 10)
  }

  const user = await prisma.user.update({
    where: { id },
    data: payload
  })

  revalidatePath('/users')
  return user
}

export async function deleteUser(id: string) {
  const actor = await requireAdmin()
  const actorIsSuperAdmin = isSuperAdminRole(actor.role)

  const user = await prisma.user.findUnique({
    where: { id },
    include: { locations: true }
  })

  if (!user) return { success: false, error: 'Benutzer nicht gefunden.' }

  if (isSuperAdminRole(user.role)) {
    if (!actorIsSuperAdmin) {
      return { success: false, error: 'Nur Super-Admins dürfen Super-Admins löschen.' }
    }
    const superAdminCount = await prisma.user.count({ where: { role: 'SUPER_ADMIN' } })
    if (superAdminCount <= 1) {
      return { success: false, error: 'Der letzte Super-Admin kann nicht gelöscht werden.' }
    }
  }

  if (isAdminRole(user.role) && !isSuperAdminRole(user.role) && !actorIsSuperAdmin) {
    return { success: false, error: 'Nur Super-Admins dürfen Admins löschen.' }
  }

  if (isAdminRole(user.role)) {
    const adminLikeCount = await prisma.user.count({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    })
    if (adminLikeCount <= 1) {
      return { success: false, error: 'Der letzte Admin kann nicht gelöscht werden.' }
    }
  }

  try {
    await prisma.user.delete({ where: { id } })
    revalidatePath('/users')
    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message?.includes('Foreign key constraint')
        ? 'Benutzer kann nicht gelöscht werden, da noch verknüpfte Daten existieren.'
        : 'Benutzer konnte nicht gelöscht werden.',
    }
  }
}
