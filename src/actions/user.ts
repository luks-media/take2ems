'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

export async function getUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      locations: true,
      equipment: {
        include: {
          location: true,
          owners: {
            select: {
              id: true
            }
          }
        },
        orderBy: { name: 'asc' }
      }
    }
  })
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      rentals: true,
    }
  })
}

export async function createUser(data: { name: string, email: string, password?: string, role: string }) {
  const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : undefined

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
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
  const payload: {
    name: string
    email: string
    role: string
    password?: string
  } = {
    name: data.name,
    email: data.email,
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
  const user = await prisma.user.findUnique({
    where: { id },
    include: { locations: true }
  })

  if (!user) return { success: false, error: 'Benutzer nicht gefunden.' }

  if (user.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
    if (adminCount <= 1) {
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
