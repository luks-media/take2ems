import prisma from '@/lib/prisma'

const SINGLETON_ID = 'singleton'

export async function getAppSettings() {
  return prisma.appSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  })
}
