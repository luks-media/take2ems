'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/session'
import { writeActivityLog } from '@/lib/activity-log'

export async function getLocations() {
  return prisma.location.findMany({
    include: {
      user: true
    },
    orderBy: { name: 'asc' }
  })
}

export async function createLocation(data: { name: string, userId?: string }) {
  const actor = await requireAdmin()

  const loc = await prisma.location.create({ data })
  revalidatePath('/users')
  revalidatePath('/equipment')
  await writeActivityLog({
    actorId: actor.id,
    entityType: 'location',
    entityId: loc.id,
    action: 'create',
    message: `Lagerort erstellt: ${loc.name}`,
    details: { userId: loc.userId ?? null },
  })
  return loc
}

export async function deleteLocation(id: string) {
  const actor = await requireAdmin()

  const location = await prisma.location.findUnique({
    where: { id },
    select: { id: true, name: true },
  })

  await prisma.location.delete({ where: { id } })
  revalidatePath('/users')
  revalidatePath('/equipment')
  await writeActivityLog({
    actorId: actor.id,
    entityType: 'location',
    entityId: id,
    action: 'delete',
    message: `Lagerort gelöscht: ${location?.name || id}`,
    details: { locationName: location?.name ?? null },
  })
}
