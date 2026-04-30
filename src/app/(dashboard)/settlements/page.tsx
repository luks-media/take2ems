import { getOwnerSettlement } from '@/actions/rental'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SettlementPostenToggle } from '@/components/settlements/SettlementPostenToggle'
import Link from 'next/link'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { ArrowUpRight, CalendarRange, ListOrdered, Receipt, Users } from 'lucide-react'
import { buildAuftragGroups, type SettlementShareDetail } from '@/lib/settlement-auftrag-groups'
import { resolveSettlementPostenView } from '@/lib/settlement-posten-view'

export const dynamic = 'force-dynamic'

function toDate(value?: string) {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function periodBadgeLabel(from?: Date, to?: Date) {
  if (from && to) {
    return `${format(from, 'dd.MM.yyyy', { locale: de })} – ${format(to, 'dd.MM.yyyy', { locale: de })}`
  }
  if (from) return `ab ${format(from, 'dd.MM.yyyy', { locale: de })}`
  if (to) return `bis ${format(to, 'dd.MM.yyyy', { locale: de })}`
  return 'Gesamter Zeitraum'
}

function rentalStatusDE(status: string) {
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

function rentalStatusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'ACTIVE') return 'default'
  if (status === 'PENDING') return 'secondary'
  if (status === 'RETURNED') return 'outline'
  if (status === 'CANCELLED') return 'destructive'
  if (status === 'QUOTE') return 'outline'
  return 'secondary'
}

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; posten?: string | string[] }
}) {
  const fromDate = toDate(searchParams.from)
  const toDateValue = toDate(searchParams.to)
  const data = await getOwnerSettlement(fromDate, toDateValue)
  const postenView = resolveSettlementPostenView(searchParams.posten)

  const auftragGroups = buildAuftragGroups(data.details as SettlementShareDetail[])
  const auftragCount = auftragGroups.length

  const grandTotal = data.totals.reduce((s, e) => s + e.totalAmount, 0)
  const totalShareLines = data.totals.reduce((s, e) => s + e.shareCount, 0)
  const ownerCount = data.totals.length
  const detailCount = data.details.length

  const eur = (n: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-8 pt-6">
      <header className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Abrechnung</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Aufteilung der Mieteinnahmen nach Equipment-Besitz (Owner-Anteile) für abgeschlossene und laufende
              Ausleihen. Filtern nach Buchungszeitraum der Ausleihe.
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 gap-1.5 py-1.5 text-sm font-normal">
            <CalendarRange className="h-3.5 w-3.5" aria-hidden />
            {periodBadgeLabel(fromDate, toDateValue)}
          </Badge>
        </div>
      </header>

      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Zeitraum</CardTitle>
          <CardDescription>
            Es werden Ausleihen berücksichtigt, deren Zeitraum in die Auswahl fällt (Start- bzw. Enddatum).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end" method="get">
            {postenView !== 'kacheln' ? <input type="hidden" name="posten" value={postenView} /> : null}
            <div className="grid w-full gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
              <div className="space-y-2">
                <label htmlFor="from" className="text-sm font-medium">
                  Von
                </label>
                <Input id="from" name="from" type="date" defaultValue={searchParams.from || ''} />
              </div>
              <div className="space-y-2">
                <label htmlFor="to" className="text-sm font-medium">
                  Bis
                </label>
                <Input id="to" name="to" type="date" defaultValue={searchParams.to || ''} />
              </div>
              <Button type="submit" className="w-full sm:w-auto">
                Anwenden
              </Button>
              <Button variant="outline" type="button" className="w-full sm:w-auto" asChild>
                <Link href="/settlements">Zurücksetzen</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {data.totals.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="shadow-sm transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Gesamtsumme</CardDescription>
              <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums tracking-tight">{eur(grandTotal)}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Owner</CardDescription>
              <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums tracking-tight">{ownerCount}</p>
              <p className="text-xs text-muted-foreground">{totalShareLines} Anteils-Zeilen gesamt</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Einzelposten</CardDescription>
              <ListOrdered className="h-4 w-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums tracking-tight">{detailCount}</p>
              <p className="text-xs text-muted-foreground">
                {auftragCount} {auftragCount === 1 ? 'Ausleihe' : 'Ausleihen'} · {detailCount}{' '}
                {detailCount === 1 ? 'Zeile' : 'Zeilen'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Summen pro Owner</h2>
          <p className="text-sm text-muted-foreground">
            Aggregierte Beträge je Besitzer aus allen passenden Ausleihen.
          </p>
        </div>
        <Card className="overflow-hidden p-0 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right tabular-nums">Anteils-Zeilen</TableHead>
                  <TableHead className="text-right tabular-nums">Summe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.totals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      Keine Daten im gewählten Zeitraum.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.totals.map((entry) => (
                    <TableRow key={entry.ownerId}>
                      <TableCell className="font-medium">{entry.ownerName}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {entry.shareCount}
                      </TableCell>
                      <TableCell className="text-right text-base font-semibold tabular-nums">
                        {eur(entry.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {data.totals.length > 0 && (
                <TableFooter>
                  <TableRow className="border-t-2 bg-muted/40 hover:bg-muted/40">
                    <TableCell className="font-semibold">Gesamt</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{totalShareLines}</TableCell>
                    <TableCell className="text-right text-base font-bold tabular-nums">{eur(grandTotal)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </Card>
      </section>

      <Separator className="my-2" />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Einzelposten</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {postenView === 'kacheln' &&
                'Gruppiert nach Ausleihe (Auftrag). Kachel antippen für die vollständige Miet-Detailansicht.'}
              {postenView === 'auftragsliste' &&
                'Eine Zeile pro Ausleihe. Über „Detail“ oder die Zeile öffnest du die Miet-Detailansicht.'}
              {postenView === 'zeilen' &&
                'Jede Zeile ist ein Owner-Anteil an einer Position. Klick auf den Kundennamen öffnet die Ausleihe.'}
            </p>
          </div>
          <SettlementPostenToggle current={postenView} className="shrink-0" />
        </div>

        {postenView === 'kacheln' && (
          <>
            {auftragGroups.length === 0 ? (
              <Card className="border-dashed bg-muted/20 p-12 text-center text-sm text-muted-foreground shadow-none">
                Keine Einzelposten für die aktuelle Auswahl.
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {auftragGroups.map((g) => {
                  const preview = g.lines.slice(0, 4)
                  const rest = g.lines.length - preview.length
                  return (
                    <Link
                      key={g.rentalId}
                      href={`/rentals/${g.rentalId}`}
                      className="group flex flex-col rounded-lg border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:border-primary/35 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="truncate font-semibold leading-tight group-hover:text-primary">
                            {g.customerLabel}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(g.startDate, 'dd.MM.yyyy', { locale: de })} –{' '}
                            {format(g.endDate, 'dd.MM.yyyy', { locale: de })}
                          </p>
                        </div>
                        <Badge variant={rentalStatusBadgeVariant(g.status)} className="shrink-0 text-[10px]">
                          {rentalStatusDE(g.status)}
                        </Badge>
                      </div>
                      <p className="mt-3 text-xl font-bold tabular-nums tracking-tight">{eur(g.totalAmount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.lines.length} {g.lines.length === 1 ? 'Anteil' : 'Anteile'} im Filter
                      </p>
                      <ul className="mt-3 space-y-1.5 border-t pt-3 text-sm">
                        {preview.map((line) => (
                          <li key={line.id} className="flex justify-between gap-2 text-muted-foreground">
                            <span className="min-w-0 truncate">
                              <span className="font-medium text-foreground">{line.ownerName}</span>
                              <span className="text-muted-foreground"> · {line.equipmentName}</span>
                            </span>
                            <span className="shrink-0 tabular-nums text-foreground">{eur(line.shareAmount)}</span>
                          </li>
                        ))}
                        {rest > 0 ? (
                          <li className="text-xs text-muted-foreground">+ {rest} weitere …</li>
                        ) : null}
                      </ul>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                        Detail anzeigen
                        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        )}

        {postenView === 'auftragsliste' && (
          <Card className="overflow-hidden p-0 shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Kunde / Projekt</TableHead>
                    <TableHead>Zeitraum</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right tabular-nums">Anteile</TableHead>
                    <TableHead className="text-right tabular-nums">Summe</TableHead>
                    <TableHead className="w-[100px] text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auftragGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Keine Einzelposten für die aktuelle Auswahl.
                      </TableCell>
                    </TableRow>
                  ) : (
                    auftragGroups.map((g) => (
                      <TableRow key={g.rentalId} className="group">
                        <TableCell className="font-medium">
                          <Link
                            href={`/rentals/${g.rentalId}`}
                            className="text-primary underline-offset-4 transition-colors hover:underline"
                          >
                            {g.customerLabel}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {format(g.startDate, 'dd.MM.yy', { locale: de })} –{' '}
                          {format(g.endDate, 'dd.MM.yy', { locale: de })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={rentalStatusBadgeVariant(g.status)} className="text-[10px]">
                            {rentalStatusDE(g.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {g.lines.length}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{eur(g.totalAmount)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="gap-1" asChild>
                            <Link href={`/rentals/${g.rentalId}`}>
                              Detail
                              <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {postenView === 'zeilen' && (
          <Card className="overflow-hidden p-0 shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Owner</TableHead>
                    <TableHead>Ausleihe</TableHead>
                    <TableHead>Artikel</TableHead>
                    <TableHead className="text-right tabular-nums">Anteil</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.details.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        Keine Einzelposten für die aktuelle Auswahl.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.details.map((detail) => (
                      <TableRow key={detail.id}>
                        <TableCell className="whitespace-nowrap font-medium">{detail.owner.name}</TableCell>
                        <TableCell>
                          <Link
                            href={`/rentals/${detail.rentalItem.rentalId}`}
                            className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
                          >
                            {detail.rentalItem.rental.customerName?.trim() || 'Ohne Kundenname'}
                          </Link>
                          <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                            {detail.rentalItem.rentalId.slice(0, 8)}…
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-muted-foreground">
                          <div className="truncate">{detail.rentalItem.equipment.name}</div>
                          {detail.isReassigned && detail.originalOwner ? (
                            <div className="mt-0.5 text-xs text-amber-700">
                              Umbuchung: {detail.originalOwner.name} -&gt; {detail.owner.name}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {eur(detail.shareAmount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </section>
    </div>
  )
}
