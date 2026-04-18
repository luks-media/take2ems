'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronDown, LayoutGrid, LayoutList, PlusCircle, Timer } from 'lucide-react'
import { RentalListRow } from '@/components/rentals/RentalListRow'
import { RentalCardGrid } from '@/components/rentals/RentalCardGrid'
import { RentalTimeline } from '@/components/rentals/RentalTimeline'
import type { RentalListRowRental } from '@/components/rentals/RentalListRow'
import { cn } from '@/lib/utils'

function isOngoingRentalStatus(status: string) {
  return status === 'PENDING' || status === 'ACTIVE'
}

function isDraftRental(status: string) {
  return status === 'DRAFT'
}

type ViewMode = 'timeline' | 'cards' | 'table'
type FilterMode = 'all' | 'ongoing' | 'drafts' | 'past'

const tableHeader = (
  <TableHeader>
    <TableRow>
      <TableHead>Kunde / Bearbeiter</TableHead>
      <TableHead>Zeitraum</TableHead>
      <TableHead>Tage</TableHead>
      <TableHead>Artikel</TableHead>
      <TableHead>Gesamtpreis</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
)

export function RentalsPageShell({ rentals }: { rentals: RentalListRowRental[] }) {
  const [view, setView] = useState<ViewMode>('timeline')
  const [filter, setFilter] = useState<FilterMode>('all')

  const filtered = useMemo(() => {
    if (filter === 'ongoing') return rentals.filter((r) => isOngoingRentalStatus(r.status))
    if (filter === 'drafts') return rentals.filter((r) => isDraftRental(r.status))
    if (filter === 'past')
      return rentals.filter((r) => !isOngoingRentalStatus(r.status) && !isDraftRental(r.status))
    return rentals
  }, [rentals, filter])

  const ongoing = useMemo(() => filtered.filter((r) => isOngoingRentalStatus(r.status)), [filtered])
  const draftsInView = useMemo(() => filtered.filter((r) => isDraftRental(r.status)), [filtered])
  const past = useMemo(
    () => filtered.filter((r) => !isOngoingRentalStatus(r.status) && !isDraftRental(r.status)),
    [filtered]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-5 overflow-y-auto p-8 pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Ausleihen</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border bg-muted/40 p-1 shadow-sm">
            <Button
              type="button"
              variant={view === 'timeline' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'gap-1.5 rounded-md shadow-none',
                view === 'timeline' && 'bg-background shadow-sm'
              )}
              onClick={() => setView('timeline')}
            >
              <Timer className="h-4 w-4" aria-hidden />
              Timeline
            </Button>
            <Button
              type="button"
              variant={view === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'gap-1.5 rounded-md shadow-none',
                view === 'cards' && 'bg-background shadow-sm'
              )}
              onClick={() => setView('cards')}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
              Kacheln
            </Button>
            <Button
              type="button"
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'gap-1.5 rounded-md shadow-none',
                view === 'table' && 'bg-background shadow-sm'
              )}
              onClick={() => setView('table')}
            >
              <LayoutList className="h-4 w-4" aria-hidden />
              Tabelle
            </Button>
          </div>
          <Link href="/rentals/new">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Neue Ausleihe
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Zeigen</span>
        {(
          [
            { id: 'all' as const, label: 'Alle' },
            { id: 'ongoing' as const, label: 'Laufend' },
            { id: 'drafts' as const, label: 'Entwürfe' },
            { id: 'past' as const, label: 'Archiv' },
          ] as const
        ).map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilter(chip.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium motion-safe:transition-all motion-safe:duration-200',
              filter === chip.id
                ? 'border-primary/40 bg-primary text-primary-foreground shadow-sm'
                : 'border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {chip.label}
            <span className="ml-1.5 tabular-nums opacity-70">
              {chip.id === 'all'
                ? rentals.length
                : chip.id === 'ongoing'
                  ? rentals.filter((r) => isOngoingRentalStatus(r.status)).length
                  : chip.id === 'drafts'
                    ? rentals.filter((r) => isDraftRental(r.status)).length
                    : rentals.filter((r) => !isOngoingRentalStatus(r.status) && !isDraftRental(r.status)).length}
            </span>
          </button>
        ))}
      </div>

      {rentals.length === 0 ? (
        <Card className="overflow-hidden p-0 shadow-sm">
          <Table>
            {tableHeader}
            <TableBody>
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Keine Ausleihen gefunden.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      ) : view === 'timeline' ? (
        <div className="rounded-2xl border bg-gradient-to-b from-card via-card to-muted/15 p-4 shadow-sm md:p-6">
          <RentalTimeline rentals={filtered} />
        </div>
      ) : view === 'cards' ? (
        <RentalCardGrid rentals={filtered} />
      ) : filter === 'past' ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Archiv</h3>
          <Card className="overflow-hidden p-0 shadow-sm">
            <Table>
              {tableHeader}
              <TableBody>
                {past.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Keine archivierten Ausleihen.
                    </TableCell>
                  </TableRow>
                ) : (
                  past.map((rental) => <RentalListRow key={rental.id} rental={rental} />)
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      ) : filter === 'drafts' ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Entwürfe</h3>
          <Card className="overflow-hidden p-0 shadow-sm">
            <Table>
              {tableHeader}
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Keine Entwürfe.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((rental) => <RentalListRow key={rental.id} rental={rental} />)
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      ) : filter === 'ongoing' ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Laufende Ausleihen</h3>
          <Card className="overflow-hidden p-0 shadow-sm">
            <Table>
              {tableHeader}
              <TableBody>
                {ongoing.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Keine laufenden Ausleihen.
                    </TableCell>
                  </TableRow>
                ) : (
                  ongoing.map((rental) => <RentalListRow key={rental.id} rental={rental} />)
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Laufende Ausleihen</h3>
            <Card className="overflow-hidden p-0 shadow-sm">
              <Table>
                {tableHeader}
                <TableBody>
                  {ongoing.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Keine laufenden Ausleihen.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ongoing.map((rental) => <RentalListRow key={rental.id} rental={rental} />)
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>

          {filter === 'all' && draftsInView.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Entwürfe</h3>
              <Card className="overflow-hidden p-0 shadow-sm">
                <Table>
                  {tableHeader}
                  <TableBody>
                    {draftsInView.map((rental) => (
                      <RentalListRow key={rental.id} rental={rental} />
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {past.length > 0 && (
            <details className="group overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm motion-safe:transition-shadow motion-safe:duration-200 open:shadow-md">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 motion-safe:transition-colors motion-safe:duration-200 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
                <span className="font-medium">Vergangene Ausleihen</span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
                  <span>{past.length}</span>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </span>
              </summary>
              <div className="border-t">
                <Table>
                  {tableHeader}
                  <TableBody>
                    {past.map((rental) => (
                      <RentalListRow key={rental.id} rental={rental} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
