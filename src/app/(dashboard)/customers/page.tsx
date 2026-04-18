import Link from 'next/link'
import prisma from '@/lib/prisma'
import { computeCustomerSaldoFromRentals } from '@/lib/customer-saldo'
import { resolveViewMode } from '@/lib/view-mode'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NewCustomerDialog } from '@/components/customers/NewCustomerDialog'
import { DirectoryViewToggle } from '@/components/layout/DirectoryViewToggle'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Library, MapPin, Mail, Phone, User, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

function formatAddress(c: {
  invoiceStreet: string | null
  invoiceZip: string | null
  invoiceCity: string | null
  invoiceCountry: string | null
}) {
  const line1 = [c.invoiceZip, c.invoiceCity].filter(Boolean).join(' ')
  const parts = [c.invoiceStreet, line1, c.invoiceCountry].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const view = resolveViewMode(searchParams.view, 'grid')

  const customers = await prisma.customer.findMany({
    orderBy: { name: 'asc' },
    include: {
      rentals: {
        select: { totalPrice: true, status: true },
      },
    },
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto space-y-6 p-8 pt-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Kunden</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Kontakt- und Rechnungsdaten pflegen. Das Saldo ergibt sich aus den hinterlegten Ausleihen (ohne
            Stornos); laufende Beträge sind PENDING und ACTIVE.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <DirectoryViewToggle defaultMode="grid" />
          <NewCustomerDialog />
          <div className="flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-sm text-muted-foreground transition-shadow duration-200 ease-out motion-reduce:transition-none hover:shadow-sm">
            <Library className="h-4 w-4" />
            <span>
              <span className="font-semibold text-foreground">{customers.length}</span> Kunden
            </span>
          </div>
        </div>
      </div>

      {customers.length === 0 ? (
        <Card className="border-dashed bg-muted/20 p-12 text-center text-muted-foreground shadow-none">
          Noch keine Kunden. Lege eine Ausleihe mit Kundenname an oder wähle einen Vorschlag in der neuen
          Ausleihe.
        </Card>
      ) : view === 'list' ? (
        <Card className="overflow-hidden p-0 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Rechnungsadresse</TableHead>
                <TableHead className="text-right">Saldo gesamt</TableHead>
                <TableHead className="text-right">Laufend</TableHead>
                <TableHead className="text-right w-[140px]">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => {
                const { totalNonCancelled, openPendingActive } = computeCustomerSaldoFromRentals(c.rentals)
                const addr = formatAddress(c)
                const contactParts = [c.contactPerson, c.email, c.phone].filter(Boolean)
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[220px]">
                      {contactParts.length > 0 ? (
                        <div className="space-y-0.5">
                          {c.contactPerson && <div>{c.contactPerson}</div>}
                          {c.email && (
                            <div className="inline-flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 shrink-0" />
                              {c.email}
                            </div>
                          )}
                          {c.phone && (
                            <div className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3 shrink-0" />
                              {c.phone}
                            </div>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[280px]">
                      <span className={addr ? '' : 'italic'}>{addr ?? 'Nicht hinterlegt'}</span>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {eur.format(totalNonCancelled)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {eur.format(openPendingActive)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/customers/${c.id}`}>Details</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {customers.map((c) => {
            const { totalNonCancelled, openPendingActive } = computeCustomerSaldoFromRentals(c.rentals)
            const addr = formatAddress(c)
            return (
              <Card key={c.id} className="flex flex-col hover:shadow-md motion-reduce:hover:shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold leading-tight line-clamp-2">{c.name}</CardTitle>
                  <CardDescription className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                    {c.contactPerson && (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {c.contactPerson}
                      </span>
                    )}
                    {c.email && (
                      <span className="inline-flex items-center gap-1 truncate max-w-full">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {c.phone}
                      </span>
                    )}
                    {!c.contactPerson && !c.email && !c.phone && (
                      <span className="text-muted-foreground">Keine Kontaktdaten hinterlegt</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-4 pt-0">
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      Rechnungsadresse
                    </div>
                    <p className={addr ? 'text-foreground' : 'text-muted-foreground italic'}>
                      {addr ?? 'Nicht hinterlegt'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Saldo gesamt</div>
                      <div className="font-semibold tabular-nums">{eur.format(totalNonCancelled)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Laufend</div>
                      <div className="font-semibold tabular-nums">{eur.format(openPendingActive)}</div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-2">
                  <Button variant="secondary" className="w-full" asChild>
                    <Link href={`/customers/${c.id}`} className="gap-2">
                      Details & bearbeiten
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
