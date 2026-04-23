'use server'

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { normalizeEmail } from '@/lib/email'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function getSecretKey() {
  const jwtSecret = process.env.JWT_SECRET?.trim()
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required')
  }
  return new TextEncoder().encode(jwtSecret)
}

export async function encrypt(payload: any) {
  const secretKey = getSecretKey()
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secretKey)
}

export async function decrypt(input: string): Promise<any> {
  const secretKey = getSecretKey()
  const { payload } = await jwtVerify(input, secretKey, {
    algorithms: ['HS256'],
  })
  return payload
}

export async function login(formData: FormData) {
  const email = normalizeEmail(String(formData.get('email') ?? ''))
  const password = formData.get('password') as string

  console.log('Login attempt for:', email)

  if (!email || !password) {
    console.log('Missing email or password')
    return { error: 'E-Mail und Passwort sind erforderlich.' }
  }

  // SQLite: "=" ist case-sensitiv — Login trotzdem case-insensitiv.
  const rows = await prisma.$queryRaw<
    { id: string; email: string; password: string | null; role: string }[]
  >`
    SELECT id, email, password, role FROM User
    WHERE lower(trim(email)) = ${email}
    LIMIT 1
  `
  const user = rows[0]

  if (!user || !user.password) {
    console.log('User not found or no password')
    return { error: 'Ungültige Anmeldedaten.' }
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  console.log('Password valid:', isPasswordValid)
  
  if (!isPasswordValid) {
    return { error: 'Ungültige Anmeldedaten.' }
  }

  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const session = await encrypt({
    user: { id: user.id, email: user.email, role: user.role },
  })
  const secure = process.env.NODE_ENV === 'production'

  cookies().set('auth_session', session, {
    expires,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
  })

  console.log('Login successful for:', email)
  return { success: true }
}

export async function logout() {
  const secure = process.env.NODE_ENV === 'production'
  cookies().set('auth_session', '', { expires: new Date(0), path: '/', secure })
  redirect('/login')
}

const MIN_PASSWORD_LEN = 8

export async function changeOwnPassword(formData: FormData) {
  const token = cookies().get('auth_session')?.value
  if (!token) {
    return { error: 'Nicht angemeldet.' }
  }
  let userId: string
  try {
    const session = await decrypt(token)
    const id = session?.user?.id
    if (typeof id !== 'string') {
      return { error: 'Ungueltige Session.' }
    }
    userId = id
  } catch {
    return { error: 'Session ungueltig.' }
  }

  const currentPassword = String(formData.get('currentPassword') ?? '')
  const newPassword = String(formData.get('newPassword') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  if (!currentPassword || !newPassword) {
    return { error: 'Alle Passwort-Felder sind erforderlich.' }
  }
  if (newPassword.length < MIN_PASSWORD_LEN) {
    return { error: `Neues Passwort mindestens ${MIN_PASSWORD_LEN} Zeichen.` }
  }
  if (newPassword !== confirmPassword) {
    return { error: 'Neue Passwoerter stimmen nicht ueberein.' }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.password) {
    return { error: 'Fuer dieses Konto ist kein Passwort hinterlegt.' }
  }

  const ok = await bcrypt.compare(currentPassword, user.password)
  if (!ok) {
    return { error: 'Aktuelles Passwort ist falsch.' }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(newPassword, 10) },
  })

  revalidatePath('/me')
  return { success: true }
}
