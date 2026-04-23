'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/session'
import { sendTestEmail } from '@/lib/mail'

const ALLOWED_RENTAL_DEFAULT_STATUS = new Set(['PENDING', 'ACTIVE'])

export async function sendSettingsTestEmail(formData: FormData) {
  await requireAdmin()
  const toRaw = formData.get('to')
  const to = typeof toRaw === 'string' ? toRaw.trim() : ''
  if (!to || to.length > 254) {
    return { error: 'Gueltige E-Mail-Adresse erforderlich.' }
  }

  try {
    await sendTestEmail(to)
    return { success: true }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Versand fehlgeschlagen.'
    return { error: message }
  }
}

export async function updateAppSettingsAction(formData: FormData) {
  await requireAdmin()

  const pdfCompanyLine = String(formData.get('pdfCompanyLine') ?? '').trim() || null
  const pdfContactLine = String(formData.get('pdfContactLine') ?? '').trim() || null
  const pdfFooterLine = String(formData.get('pdfFooterLine') ?? '').trim() || null

  const rentalDefaultStatus = String(formData.get('rentalDefaultStatus') ?? 'PENDING').trim()
  if (!ALLOWED_RENTAL_DEFAULT_STATUS.has(rentalDefaultStatus)) {
    return { error: 'Ungueltiger Standard-Status.' }
  }

  const discountRaw = formData.get('rentalDiscountAllowed')
  const rentalDiscountAllowed = discountRaw === 'on' || discountRaw === 'true'

  const minDaysRaw = Number.parseInt(String(formData.get('rentalMinDays') ?? '1'), 10)
  if (!Number.isFinite(minDaysRaw) || minDaysRaw < 1 || minDaysRaw > 365) {
    return { error: 'Mindest-Miettage muessen zwischen 1 und 365 liegen.' }
  }

  await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      pdfCompanyLine,
      pdfContactLine,
      pdfFooterLine,
      rentalDefaultStatus,
      rentalDiscountAllowed,
      rentalMinDays: minDaysRaw,
    },
    update: {
      pdfCompanyLine,
      pdfContactLine,
      pdfFooterLine,
      rentalDefaultStatus,
      rentalDiscountAllowed,
      rentalMinDays: minDaysRaw,
    },
  })

  revalidatePath('/settings')
  revalidatePath('/rentals/new')
  return { success: true }
}

export async function updateGoogleCalendarSettingsAction(formData: FormData) {
  try {
    await requireAdmin()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Keine Berechtigung.'
    return { error: message }
  }

  const calendarId = String(formData.get('googleCalendarId') ?? '').trim() || null
  const syncRaw = formData.get('googleCalendarSyncEnabled')
  const googleCalendarSyncEnabled = syncRaw === 'on' || syncRaw === 'true'

  try {
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        googleCalendarId: calendarId,
        googleCalendarSyncEnabled,
      },
      update: {
        googleCalendarId: calendarId,
        googleCalendarSyncEnabled,
      },
    })
  } catch {
    return { error: 'Datenbankfehler beim Speichern.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function disconnectGoogleCalendarAction() {
  try {
    await requireAdmin()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Keine Berechtigung.'
    return { error: message }
  }

  try {
    await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        googleCalendarRefreshTokenEnc: null,
      },
      update: {
        googleCalendarRefreshTokenEnc: null,
      },
    })
  } catch {
    return { error: 'Datenbankfehler beim Trennen.' }
  }

  revalidatePath('/settings')
  return { success: true }
}
