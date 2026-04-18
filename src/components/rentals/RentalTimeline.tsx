'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { format, startOfMonth } from 'date-fns'
import { de } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { RentalListRowRental } from '@/components/rentals/RentalListRow'
import { rentalStatusDisplay } from '@/components/rentals/rentalDisplayUtils'
import { CalendarRange, ChevronRight, Sparkles } from 'lucide-react'
import { EquipmentCategoryIcon } from '@/lib/equipment-category-icon'

function PeriodProgress({ rental }: { rental: RentalListRowRental }) {
  if (
    rental.status === 'RETURNED' ||
    rental.status === 'CANCELLED' ||
    rental.status === 'DRAFT' ||
    rental.status === 'QUOTE'
  ) {
    return null
  }
  const start = new Date(rental.startDate).getTime()
  const end = new Date(rental.endDate).getTime()
  const now = Date.now()
  if (end <= start) return null
  let pct = 0
  if (now <= start) pct = 0
  else if (now >= end) pct = 100
  else pct = ((now - start) / (end - start)) * 100

  return (
    <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted/80">
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary/50 via-primary to-primary/70 motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function RentalTimeline({ rentals }: { rentals: RentalListRowRental[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, RentalListRowRental[]>()
    for (const r of rentals) {
      const m = startOfMonth(new Date(r.startDate))
      const key = format(m, 'yyyy-MM')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a))
    return sortedKeys.map((key) => {
      const items = map.get(key)!
      items.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      const label = format(startOfMonth(new Date(items[0]!.startDate)), 'MMMM yyyy', { locale: de })
      return { key, label, items }
    })
  }, [rentals])

  if (rentals.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <Sparkles className="mb-3 h-8 w-8 text-muted-foreground/60" aria-hidden />
        <p className="text-sm font-medium text-muted-foreground">Keine Ausleihen für diese Ansicht.</p>
      </div>
    )
  }

  let globalIndex = 0

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute left-[15px] top-3 bottom-3 w-px origin-top bg-gradient-to-b from-primary/25 via-border to-transparent motion-safe:animate-timeline-line motion-reduce:scale-y-100 motion-reduce:animate-none max-md:left-[11px]"
        aria-hidden
      />

      <div className="space-y-10 md:space-y-14">
        {groups.map((group) => (
          <section key={group.key} className="relative">
            <div className="sticky top-0 z-10 -mx-1 mb-6 flex items-center gap-3 bg-background/80 px-1 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
              <span className="inline-flex h-8 items-center rounded-full border bg-card px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-sm">
                {group.label}
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
            </div>

            <ul className="relative space-y-5 md:space-y-6">
              {group.items.map((rental) => {
                const meta = rentalStatusDisplay(rental.status)
                const label =
                  rental.customerName?.trim() ||
                  (rental.user ? `Bearbeiter: ${rental.user.name}` : `Ausleihe ${rental.id.slice(0, 8)}…`)
                const delay = globalIndex * 55
                globalIndex += 1

                return (
                  <li
                    key={rental.id}
                    className="motion-safe:animate-timeline-in relative pl-10 motion-reduce:animate-none md:pl-12"
                    style={{ animationDelay: `${delay}ms` }}
                  >
                    <div
                      className={cn(
                        'absolute left-0 top-5 flex h-8 w-8 items-center justify-center rounded-full border bg-card shadow-sm md:left-1 md:top-4 md:h-9 md:w-9',
                        'ring-2 ring-offset-2 ring-offset-background',
                        meta.ring
                      )}
                    >
                      <span className={cn('h-2.5 w-2.5 rounded-full md:h-3 md:w-3', meta.dot)} />
                    </div>

                    <Link
                      href={`/rentals/${rental.id}`}
                      className={cn(
                        'group block overflow-hidden rounded-2xl border bg-card/95 text-card-foreground shadow-sm',
                        'motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out',
                        'hover:border-primary/25 hover:shadow-md hover:shadow-primary/5',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                      )}
                    >
                      <div className="relative p-4 md:p-5">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 motion-safe:transition-opacity motion-safe:duration-300 group-hover:opacity-100" />

                        <div className="relative flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-semibold tracking-tight md:text-lg">{label}</h3>
                              <Badge variant={meta.badge} className="shrink-0 font-normal">
                                {meta.label}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5 tabular-nums">
                                <CalendarRange className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                                {format(new Date(rental.startDate), 'dd.MM.yyyy', { locale: de })} –{' '}
                                {format(new Date(rental.endDate), 'dd.MM.yyyy', { locale: de })}
                                <span className="text-muted-foreground/70">· {rental.totalDays} Tage</span>
                              </span>
                            </div>

                            {rental.user && (
                              <p className="text-xs text-muted-foreground">Bearbeiter: {rental.user.name}</p>
                            )}

                            <p className="line-clamp-2 pt-1 text-xs leading-relaxed text-muted-foreground md:text-sm">
                              <span className="font-medium text-foreground/90">
                                {rental.items.length} {rental.items.length === 1 ? 'Artikel' : 'Artikel'}:{' '}
                              </span>
                              {rental.items.length === 0 ? (
                                '—'
                              ) : (
                                <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                  {rental.items.map((i, idx) => (
                                    <span key={i.id} className="inline-flex items-center gap-1">
                                      <EquipmentCategoryIcon
                                        category={i.equipment.category}
                                        className="h-3.5 w-3.5 text-muted-foreground/70"
                                      />
                                      <span>
                                        {i.equipment.name}
                                        {idx < rental.items.length - 1 ? ',' : ''}
                                      </span>
                                    </span>
                                  ))}
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-row items-center justify-between gap-3 md:flex-col md:items-end md:text-right">
                            <p className="text-lg font-semibold tabular-nums tracking-tight md:text-xl">
                              {rental.totalPrice.toFixed(2)}{' '}
                              <span className="text-sm font-normal text-muted-foreground">€</span>
                            </p>
                            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary opacity-80 motion-safe:transition-transform motion-safe:duration-300 group-hover:translate-x-0.5 group-hover:opacity-100">
                              Details
                              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                            </span>
                          </div>
                        </div>

                        <PeriodProgress rental={rental} />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
