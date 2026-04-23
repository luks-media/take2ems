'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { requireSessionUser } from '@/lib/session'

export type CustomerSearchHit = { id: string; name: string }

/** Kunden für Autocomplete (Ausleihe). Nur für angemeldete Nutzer. */
export async function searchCustomers(query: string): Promise<CustomerSearchHit[]> {
  try {
    await requireSessionUser()
  } catch {
    return []
  }

  const q = query.trim()
  if (q.length < 1) return []

  const safe = q.replace(/[%_\\]/g, '')
  if (safe.length < 1) return []

  const pattern = `%${safe}%`
  return prisma.$queryRaw<CustomerSearchHit[]>(
    Prisma.sql`SELECT id, name FROM Customer WHERE LOWER(name) LIKE LOWER(${pattern}) ORDER BY name ASC LIMIT 20`
  )
}

function optTrim(value: string | undefined): string | null {
  const t = value?.trim()
  return t ? t : null
}

export async function createCustomer(data: {
  name: string
  contactPerson?: string
  email?: string
  phone?: string
  notes?: string
  invoiceCompany?: string
  invoiceStreet?: string
  invoiceZip?: string
  invoiceCity?: string
  invoiceCountry?: string
  invoiceVatId?: string
}): Promise<{ id: string }> {
  await requireSessionUser()

  const name = data.name?.trim()
  if (!name) {
    throw new Error('Name ist erforderlich.')
  }

  const dup = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT id FROM Customer WHERE LOWER(name) = LOWER(${name}) LIMIT 1`
  )
  if (dup[0]) {
    throw new Error('Ein Kunde mit diesem Namen existiert bereits.')
  }

  const customer = await prisma.customer.create({
    data: {
      name,
      contactPerson: optTrim(data.contactPerson),
      email: optTrim(data.email),
      phone: optTrim(data.phone),
      notes: optTrim(data.notes),
      invoiceCompany: optTrim(data.invoiceCompany),
      invoiceStreet: optTrim(data.invoiceStreet),
      invoiceZip: optTrim(data.invoiceZip),
      invoiceCity: optTrim(data.invoiceCity),
      invoiceCountry: optTrim(data.invoiceCountry),
      invoiceVatId: optTrim(data.invoiceVatId),
    },
    select: { id: true },
  })

  revalidatePath('/customers')
  return { id: customer.id }
}

export async function updateCustomer(data: {
  id: string
  name: string
  contactPerson?: string
  email?: string
  phone?: string
  notes?: string
  invoiceCompany?: string
  invoiceStreet?: string
  invoiceZip?: string
  invoiceCity?: string
  invoiceCountry?: string
  invoiceVatId?: string
}) {
  await requireSessionUser()

  const name = data.name?.trim()
  if (!name) {
    throw new Error('Name ist erforderlich.')
  }

  await prisma.customer.update({
    where: { id: data.id },
    data: {
      name,
      contactPerson: optTrim(data.contactPerson),
      email: optTrim(data.email),
      phone: optTrim(data.phone),
      notes: optTrim(data.notes),
      invoiceCompany: optTrim(data.invoiceCompany),
      invoiceStreet: optTrim(data.invoiceStreet),
      invoiceZip: optTrim(data.invoiceZip),
      invoiceCity: optTrim(data.invoiceCity),
      invoiceCountry: optTrim(data.invoiceCountry),
      invoiceVatId: optTrim(data.invoiceVatId),
    },
  })

  revalidatePath('/customers')
  revalidatePath(`/customers/${data.id}`)
}
