'use client'

import { useRouter } from 'next/navigation'
import type { KeyboardEvent, ReactNode } from 'react'
import { TableRow } from '@/components/ui/table'

type Props = {
  rentalId: string
  children: ReactNode
}

export function RentalsTableRow({ rentalId, children }: Props) {
  const router = useRouter()

  function go() {
    router.push(`/rentals/${rentalId}`)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      go()
    }
  }

  return (
    <TableRow
      tabIndex={0}
      className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={go}
      onKeyDown={onKeyDown}
    >
      {children}
    </TableRow>
  )
}
