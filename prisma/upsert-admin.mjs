/**
 * Rettet den ersten Login auf dem Server:
 * Liest INITIAL_ADMIN_EMAIL + INITIAL_ADMIN_PASSWORD aus der Umgebung (Docker Compose env_file).
 * – Gibt es schon einen User mit dieser E-Mail (egal welche Großschreibung): Passwort wird gesetzt, Rolle ADMIN.
 * – Sonst: neuer Admin-User.
 *
 * Ausführung im laufenden Container:
 *   docker compose exec ems npm run admin:upsert
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function normalizeEmail(raw) {
  return String(raw ?? '').trim().toLowerCase()
}

async function main() {
  const email = normalizeEmail(process.env.INITIAL_ADMIN_EMAIL)
  const password = process.env.INITIAL_ADMIN_PASSWORD

  if (!email || !password) {
    console.error(
      '[admin:upsert] INITIAL_ADMIN_EMAIL und INITIAL_ADMIN_PASSWORD müssen in .env stehen (Compose lädt sie in den Container).'
    )
    process.exit(1)
  }

  const hash = await bcrypt.hash(password, 10)

  const rows = await prisma.$queryRaw`SELECT id FROM User WHERE lower(trim(email)) = ${email} LIMIT 1`
  const id = rows[0]?.id

  if (id) {
    await prisma.user.update({
      where: { id },
      data: { email, password: hash, role: 'ADMIN' },
    })
    console.log('[admin:upsert] Passwort gesetzt / E-Mail normalisiert für:', email)
    return
  }

  await prisma.user.create({
    data: {
      name: 'Admin',
      email,
      password: hash,
      role: 'ADMIN',
    },
  })
  console.log('[admin:upsert] Neuer Admin angelegt:', email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
