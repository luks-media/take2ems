'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { KeyboardEvent } from 'react'
import { TableCell, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { EquipmentCategoryIcon } from '@/lib/equipment-category-icon'

export type RentalListRowRental = {
  id: string
  title?: string | null
  customerName: string | null
  customer: { id: string; name: string } | null
  startDate: Date | string
  endDate: Date | string
  totalDays: number
  totalPrice: number
  status: string
  user: { id: string; name: string; email: string } | null
  items: { id: string; equipment: { name: string; category: string } }[]
}

export function RentalListRow({ rental }: { rental: RentalListRowRental }) {
  const router = useRouter()
  const href = `/rentals/${rental.id}`

  const open = () => {
    router.push(href)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  }

  const label =
    rental.title?.trim() ||
    rental.customerName?.trim() ||
    (rental.user ? `Bearbeiter: ${rental.user.name}` : `Ausleihe ${rental.id}`)

  return (
    <TableRow
      className="cursor-pointer"
      role="link"
      tabIndex={0}
      aria-label={`${label}: Detailansicht öffnen`}
      onClick={open}
      onKeyDown={onKeyDown}
    >
      <TableCell className="font-medium">
        <div className="flex flex-col gap-0.5">
          {rental.customer ? (
            <Link
              href={`/customers/${rental.customer.id}`}
              className="text-primary underline-offset-4 transition-colors duration-200 ease-out motion-reduce:transition-none hover:underline w-fit"
              onClick={(e) => e.stopPropagation()}
            >
              {rental.title?.trim() || rental.customerName || rental.customer.name}
            </Link>
          ) : (
            <span>{rental.title?.trim() || rental.customerName || '—'}</span>
          )}
          {rental.user ? (
            <span className="text-xs font-normal text-muted-foreground">Bearbeiter: {rental.user.name}</span>
          ) : (
            <span className="text-xs font-normal text-muted-foreground">Kein Bearbeiter</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {format(new Date(rental.startDate), 'dd.MM.yyyy', { locale: de })} -{' '}
        {format(new Date(rental.endDate), 'dd.MM.yyyy', { locale: de })}
      </TableCell>
      <TableCell>{rental.totalDays}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-semibold">
            {rental.items.length} {rental.items.length === 1 ? 'Artikel' : 'Artikel'}
          </span>
          <span className="flex max-w-[280px] flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {rental.items.map((i) => (
              <span key={i.id} className="inline-flex min-w-0 max-w-full items-center gap-1">
                <EquipmentCategoryIcon category={i.equipment.category} className="h-3.5 w-3.5 text-muted-foreground/80" />
                <span className="truncate">{i.equipment.name}</span>
              </span>
            ))}
          </span>
        </div>
      </TableCell>
      <TableCell className="font-medium">{rental.totalPrice.toFixed(2)} €</TableCell>
      <TableCell>
        <Badge
          variant={
            rental.status === 'PENDING'
              ? 'secondary'
              : rental.status === 'ACTIVE'
                ? 'default'
                : rental.status === 'RETURNED'
                  ? 'outline'
                  : rental.status === 'CANCELLED'
                    ? 'destructive'
                    : rental.status === 'QUOTE'
                      ? 'outline'
                      : 'secondary'
          }
        >
          {rental.status === 'PENDING'
            ? 'Ausstehend'
            : rental.status === 'ACTIVE'
              ? 'Aktiv'
              : rental.status === 'RETURNED'
                ? 'Zurückgegeben'
                : rental.status === 'CANCELLED'
                  ? 'Storniert'
                  : rental.status === 'DRAFT'
                    ? 'Entwurf'
                    : rental.status === 'QUOTE'
                      ? 'Angebot'
                      : rental.status}
        </Badge>
      </TableCell>
    </TableRow>
  )
}
