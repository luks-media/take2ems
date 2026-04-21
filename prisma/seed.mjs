import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.user.count()
  if (existing > 0) {
    return
  }

  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.INITIAL_ADMIN_PASSWORD

  if (!email || !password) {
    console.warn(
      '[prisma seed] No users in DB. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (e.g. in .env) to create the first admin, then restart the container.'
    )
    return
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  await prisma.user.create({
    data: {
      name: 'Admin',
      email,
      password: hashedPassword,
      role: 'ADMIN',
    },
  })
  console.log('[prisma seed] Created initial admin:', email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
