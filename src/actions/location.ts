'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/session'

export async function getLocations() {
  return prisma.location.findMany({
    include: {
      user: true
    },
    orderBy: { name: 'asc' }
  })
}

export async function createLocation(data: { name: string, userId?: string }) {
  await requireAdmin()

  const loc = await prisma.location.create({ data })
  revalidatePath('/users')
  revalidatePath('/equipment')
  return loc
}

export async function deleteLocation(id: string) {
  await requireAdmin()

  await prisma.location.delete({ where: { id } })
  revalidatePath('/users')
  revalidatePath('/equipment')
}
