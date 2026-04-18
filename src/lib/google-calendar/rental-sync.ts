import { addDays } from 'date-fns'
import { google } from 'googleapis'
import prisma from '@/lib/prisma'
import { getAppOrigin } from '@/lib/app-origin'
import { getCalendarOAuth2FromRefreshToken } from '@/lib/google-calendar/oauth'

function localDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type RentalForCal = {
  id: string
  customerName: string | null
  startDate: Date
  endDate: Date
  totalDays: number
  totalPrice: number
  status: string
  googleCalendarEventId: string | null
  items: { quantity: number; equipment: { name: string } }[]
}

function buildEventPayload(rental: RentalForCal) {
  const origin = getAppOrigin()
  const customer = rental.customerName?.trim() || 'Unbekannt'
  const equipNames = rental.items.map((i) => `${i.quantity}× ${i.equipment.name}`).join(', ')
  const titlePrefix =
    rental.status === 'RETURNED'
      ? '[Zurück] '
      : rental.status === 'PENDING'
        ? '[Ausstehend] '
        : rental.status === 'DRAFT'
          ? '[Entwurf] '
          : rental.status === 'QUOTE'
            ? '[Angebot] '
            : ''
  const title = `${titlePrefix}Ausleihe: ${customer} – ${equipNames}`.slice(0, 200)
  const link = `${origin}/rentals/${rental.id}`
  const description = [
    `Status: ${rental.status}`,
    `Zeitraum: ${localDateString(rental.startDate)} – ${localDateString(rental.endDate)} (${rental.totalDays} Tage)`,
    `Gesamtpreis: ${rental.totalPrice.toFixed(2)} EUR`,
    link,
  ].join('\n')

  const startDate = localDateString(rental.startDate)
  const endExclusive = localDateString(addDays(rental.endDate, 1))

  return {
    summary: title,
    description,
    start: { date: startDate },
    end: { date: endExclusive },
  }
}

async function getCalendarContext(options: { requireSyncEnabled: boolean }) {
  const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })
  if (!settings?.googleCalendarRefreshTokenEnc) {
    return null
  }
  if (options.requireSyncEnabled && !settings.googleCalendarSyncEnabled) {
    return null
  }
  const calendarId = settings.googleCalendarId?.trim() || 'primary'
  const auth = getCalendarOAuth2FromRefreshToken(settings.googleCalendarRefreshTokenEnc)
  const calendar = google.calendar({ version: 'v3', auth })
  return { calendar, calendarId }
}

export async function syncRentalCalendarAfterCreate(rentalId: string) {
  try {
    const ctx = await getCalendarContext({ requireSyncEnabled: true })
    if (!ctx) return

    const rental = await prisma.rental.findUnique({
      where: { id: rentalId },
      include: { items: { include: { equipment: true } } },
    })
    if (!rental) return
    if (rental.status === 'DRAFT' || rental.status === 'QUOTE') return

    const body = buildEventPayload(rental)
    const created = await ctx.calendar.events.insert({
      calendarId: ctx.calendarId,
      requestBody: body,
    })
    const eventId = created.data.id
    if (eventId) {
      await prisma.rental.update({
        where: { id: rentalId },
        data: { googleCalendarEventId: eventId },
      })
    }
  } catch (e) {
    console.error('[google-calendar] create sync failed', e)
  }
}

export async function syncRentalCalendarAfterStatusChange(rentalId: string) {
  try {
    const ctx = await getCalendarContext({ requireSyncEnabled: true })
    if (!ctx) return

    const rental = await prisma.rental.findUnique({
      where: { id: rentalId },
      include: { items: { include: { equipment: true } } },
    })
    if (!rental) return

    if (rental.status === 'CANCELLED') {
      if (rental.googleCalendarEventId) {
        try {
          await ctx.calendar.events.delete({
            calendarId: ctx.calendarId,
            eventId: rental.googleCalendarEventId,
          })
        } catch (delErr) {
          console.error('[google-calendar] delete on cancel', delErr)
        }
        await prisma.rental.update({
          where: { id: rentalId },
          data: { googleCalendarEventId: null },
        })
      }
      return
    }

    if (!rental.googleCalendarEventId) {
      const body = buildEventPayload(rental)
      const created = await ctx.calendar.events.insert({
        calendarId: ctx.calendarId,
        requestBody: body,
      })
      const eventId = created.data.id
      if (eventId) {
        await prisma.rental.update({
          where: { id: rentalId },
          data: { googleCalendarEventId: eventId },
        })
      }
      return
    }

    const body = buildEventPayload(rental)
    await ctx.calendar.events.patch({
      calendarId: ctx.calendarId,
      eventId: rental.googleCalendarEventId,
      requestBody: body,
    })
  } catch (e) {
    console.error('[google-calendar] status sync failed', e)
  }
}

export async function deleteRentalCalendarEvent(eventId: string | null) {
  if (!eventId) return
  try {
    const ctx = await getCalendarContext({ requireSyncEnabled: false })
    if (!ctx) return
    await ctx.calendar.events.delete({
      calendarId: ctx.calendarId,
      eventId,
    })
  } catch (e) {
    console.error('[google-calendar] delete on rental remove', e)
  }
}
