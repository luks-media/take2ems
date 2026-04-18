import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => new PrismaClient()

declare global {
  var prismaGlobal: undefined | PrismaClient
}

/**
 * In Dev bleibt ein globaler PrismaClient nach `prisma generate` / Schema-Änderungen
 * sonst veraltet (neue Models fehlen → z. B. prisma.customer ist undefined).
 * Dann Client neu erzeugen.
 */
function getPrisma(): PrismaClient {
  if (process.env.NODE_ENV === 'production') {
    return globalThis.prismaGlobal ?? prismaClientSingleton()
  }

  const existing = globalThis.prismaGlobal
  if (existing?.customer) {
    return existing
  }

  const client = prismaClientSingleton()
  globalThis.prismaGlobal = client
  return client
}

const prisma = getPrisma()

export default prisma
