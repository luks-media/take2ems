'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { RentalListRowRental } from '@/components/rentals/RentalListRow'
import { rentalStatusDisplay } from '@/components/rentals/rentalDisplayUtils'
import { CalendarRange, ChevronRight, LayoutGrid, Sparkles } from 'lucide-react'
import { EquipmentCategoryIcon } from '@/lib/equipment-category-icon'

function RentalPeriodBar({ rental }: { rental: RentalListRowRental }) {
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
    <div className="h-1 overflow-hidden rounded-full bg-muted/80">
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary/50 via-primary to-primary/70 motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function RentalCardGrid({ rentals }: { rentals: RentalListRowRental[] }) {
  const sorted = useMemo(
    () =>
      [...rentals].sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      ),
    [rentals]
  )

  if (rentals.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <Sparkles className="mb-3 h-8 w-8 text-muted-foreground/60" aria-hidden />
        <p className="text-sm font-medium text-muted-foreground">Keine Ausleihen für diese Ansicht.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-gradient-to-b from-card via-card to-muted/10 p-4 shadow-sm md:p-6">
      <div className="mb-4 flex items-center gap-2 text-muted-foreground">
        <LayoutGrid className="h-4 w-4" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wide">Kachelansicht</span>
        <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
        <span className="text-xs tabular-nums">{sorted.length}</span>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((rental, index) => {
          const meta = rentalStatusDisplay(rental.status)
          const label =
            rental.title?.trim() ||
            rental.customerName?.trim() ||
            (rental.user ? `Bearbeiter: ${rental.user.name}` : `Ausleihe ${rental.id.slice(0, 8)}…`)

          return (
            <li
              key={rental.id}
              className="motion-safe:animate-timeline-in motion-reduce:animate-none"
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <Link
                href={`/rentals/${rental.id}`}
                className={cn(
                  'group relative flex h-full min-h-[200px] flex-col overflow-hidden rounded-2xl border bg-card/95 p-4 text-card-foreground shadow-sm',
                  'motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out',
                  'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                )}
              >
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent opacity-0 motion-safe:transition-opacity motion-safe:duration-300 group-hover:opacity-100" />

                <div className="relative flex flex-1 flex-col">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-background/80 shadow-sm',
                        'ring-2 ring-offset-2 ring-offset-card',
                        meta.ring
                      )}
                    >
                      <span className={cn('h-2.5 w-2.5 rounded-full', meta.dot)} />
                    </div>
                    <Badge variant={meta.badge} className="shrink-0 text-[10px] font-medium uppercase tracking-wide">
                      {meta.label}
                    </Badge>
                  </div>

                  <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug tracking-tight md:text-base">
                    {label}
                  </h3>

                  <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-muted-foreground tabular-nums">
                    <CalendarRange className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    <span>
                      {format(new Date(rental.startDate), 'dd.MM.yy', { locale: de })} –{' '}
                      {format(new Date(rental.endDate), 'dd.MM.yy', { locale: de })}
                      <span className="text-muted-foreground/80"> · {rental.totalDays} Tg.</span>
                    </span>
                  </p>

                  {rental.user && (
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">{rental.user.name}</p>
                  )}

                  <p className="mt-3 line-clamp-3 min-h-0 flex-1 text-[11px] leading-relaxed text-muted-foreground">
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

                  <div className="mt-3 flex items-end justify-between gap-2 border-t border-border/60 pt-3">
                    <p className="text-lg font-bold tabular-nums tracking-tight">
                      {rental.totalPrice.toFixed(2)}
                      <span className="ml-0.5 text-xs font-normal text-muted-foreground">€</span>
                    </p>
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary opacity-90 motion-safe:transition-transform motion-safe:duration-300 group-hover:translate-x-0.5">
                      Öffnen
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </div>

                  <div className="mt-auto pt-3">
                    <RentalPeriodBar rental={rental} />
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
