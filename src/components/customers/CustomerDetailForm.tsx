'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateCustomer } from '@/actions/customer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

export type CustomerDetailFormProps = {
  customer: {
    id: string
    name: string
    contactPerson: string | null
    email: string | null
    phone: string | null
    notes: string | null
    invoiceCompany: string | null
    invoiceStreet: string | null
    invoiceZip: string | null
    invoiceCity: string | null
    invoiceCountry: string | null
    invoiceVatId: string | null
  }
  saldoTotal: number
  saldoOpen: number
  rentals: {
    id: string
    totalPrice: number
    status: string
    startDate: string
    endDate: string
  }[]
}

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

function statusLabel(status: string) {
  switch (status) {
    case 'PENDING':
      return 'Ausstehend'
    case 'ACTIVE':
      return 'Aktiv'
    case 'RETURNED':
      return 'Zurückgegeben'
    case 'CANCELLED':
      return 'Storniert'
    case 'DRAFT':
      return 'Entwurf'
    case 'QUOTE':
      return 'Angebot'
    default:
      return status
  }
}

function statusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'PENDING') return 'secondary'
  if (status === 'ACTIVE') return 'default'
  if (status === 'RETURNED') return 'outline'
  if (status === 'CANCELLED') return 'destructive'
  if (status === 'QUOTE') return 'outline'
  return 'secondary'
}

export function CustomerDetailForm({ customer, saldoTotal, saldoOpen, rentals }: CustomerDetailFormProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    try {
      await updateCustomer({
        id: customer.id,
        name: String(fd.get('name') ?? ''),
        contactPerson: String(fd.get('contactPerson') ?? ''),
        email: String(fd.get('email') ?? ''),
        phone: String(fd.get('phone') ?? ''),
        notes: String(fd.get('notes') ?? ''),
        invoiceCompany: String(fd.get('invoiceCompany') ?? ''),
        invoiceStreet: String(fd.get('invoiceStreet') ?? ''),
        invoiceZip: String(fd.get('invoiceZip') ?? ''),
        invoiceCity: String(fd.get('invoiceCity') ?? ''),
        invoiceCountry: String(fd.get('invoiceCountry') ?? ''),
        invoiceVatId: String(fd.get('invoiceVatId') ?? ''),
      })
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Saldo aus Ausleihen</h3>
        <p className="text-xs text-muted-foreground">
          Summe der Mietpreise ohne Stornos. „Laufend“ = ausstehend oder aktiv (noch nicht zurückgegeben).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="text-xs text-muted-foreground">Gesamt (alle gültigen Ausleihen)</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{eur.format(saldoTotal)}</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="text-xs text-muted-foreground">Laufend (PENDING / ACTIVE)</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{eur.format(saldoOpen)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Stammdaten</h3>
        <Separator />
        <div className="grid gap-2">
          <Label htmlFor="name">Name / Projekt</Label>
          <Input id="name" name="name" defaultValue={customer.name} required placeholder="z. B. Mustermann GmbH" />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Kontakt</h3>
        <Separator />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="contactPerson">Ansprechpartner</Label>
            <Input
              id="contactPerson"
              name="contactPerson"
              defaultValue={customer.contactPerson ?? ''}
              placeholder="Name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" name="email" type="email" defaultValue={customer.email ?? ''} placeholder="mail@example.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={customer.phone ?? ''} placeholder="+49 …" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Rechnungsadresse</h3>
        <Separator />
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="invoiceCompany">Firma / Name auf der Rechnung</Label>
            <Input
              id="invoiceCompany"
              name="invoiceCompany"
              defaultValue={customer.invoiceCompany ?? ''}
              placeholder="optional, falls abweichend vom Kundennamen"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invoiceStreet">Straße, Hausnummer</Label>
            <Input id="invoiceStreet" name="invoiceStreet" defaultValue={customer.invoiceStreet ?? ''} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="invoiceZip">PLZ</Label>
              <Input id="invoiceZip" name="invoiceZip" defaultValue={customer.invoiceZip ?? ''} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="invoiceCity">Ort</Label>
              <Input id="invoiceCity" name="invoiceCity" defaultValue={customer.invoiceCity ?? ''} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="invoiceCountry">Land</Label>
              <Input id="invoiceCountry" name="invoiceCountry" defaultValue={customer.invoiceCountry ?? ''} placeholder="z. B. Deutschland" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invoiceVatId">USt-IdNr.</Label>
              <Input id="invoiceVatId" name="invoiceVatId" defaultValue={customer.invoiceVatId ?? ''} placeholder="optional" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Notizen</h3>
        <Separator />
        <div className="grid gap-2">
          <Label htmlFor="notes">Interne Notizen</Label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={customer.notes ?? ''}
            placeholder="optional"
            rows={3}
            className={cn(
              'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'ring-offset-background placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Speichern…' : 'Änderungen speichern'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/customers">Zur Übersicht</Link>
        </Button>
      </div>

      {rentals.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="text-lg font-semibold">Letzte Ausleihen</h3>
          <Separator />
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeitraum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm tabular-nums">
                      {format(new Date(r.startDate), 'dd.MM.yyyy', { locale: de })} –{' '}
                      {format(new Date(r.endDate), 'dd.MM.yyyy', { locale: de })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{eur.format(r.totalPrice)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/rentals/${r.id}`} className="text-sm text-primary underline-offset-4 hover:underline">
                        Öffnen
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </form>
  )
}
