'use client'

import { Suspense, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SettlementPostenView } from '@/lib/settlement-posten-view'
import { LayoutGrid, List, Table2 } from 'lucide-react'

function InnerSettlementPostenToggle({
  current,
  className,
}: {
  current: SettlementPostenView
  className?: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { hrefKacheln, hrefAuftragsliste, hrefZeilen } = useMemo(() => {
    const base = new URLSearchParams(searchParams.toString())
    const withPosten = (v: SettlementPostenView) => {
      const p = new URLSearchParams(base.toString())
      if (v === 'kacheln') {
        p.delete('posten')
      } else {
        p.set('posten', v)
      }
      const q = p.toString()
      return q ? `${pathname}?${q}` : pathname
    }
    return {
      hrefKacheln: withPosten('kacheln'),
      hrefAuftragsliste: withPosten('auftragsliste'),
      hrefZeilen: withPosten('zeilen'),
    }
  }, [pathname, searchParams])

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border bg-muted/30 p-0.5 transition-[box-shadow,background-color] duration-200 ease-out motion-reduce:transition-none',
        className
      )}
      role="group"
      aria-label="Darstellung der Einzelposten"
    >
      <Button
        asChild
        variant="ghost"
        size="sm"
        className={cn('h-8 gap-1.5 px-2.5', current === 'kacheln' && 'bg-background shadow-sm')}
      >
        <Link href={hrefKacheln} scroll={false} aria-current={current === 'kacheln' ? 'true' : undefined}>
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden sm:inline">Kacheln</span>
        </Link>
      </Button>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className={cn('h-8 gap-1.5 px-2.5', current === 'auftragsliste' && 'bg-background shadow-sm')}
      >
        <Link
          href={hrefAuftragsliste}
          scroll={false}
          aria-current={current === 'auftragsliste' ? 'true' : undefined}
        >
          <List className="h-4 w-4" />
          <span className="hidden sm:inline">Aufträge</span>
        </Link>
      </Button>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className={cn('h-8 gap-1.5 px-2.5', current === 'zeilen' && 'bg-background shadow-sm')}
      >
        <Link href={hrefZeilen} scroll={false} aria-current={current === 'zeilen' ? 'true' : undefined}>
          <Table2 className="h-4 w-4" />
          <span className="hidden sm:inline">Alle Zeilen</span>
        </Link>
      </Button>
    </div>
  )
}

export function SettlementPostenToggle({
  current,
  className,
}: {
  current: SettlementPostenView
  className?: string
}) {
  return (
    <Suspense
      fallback={
        <div className={cn('h-9 w-[11rem] rounded-md border bg-muted/20 animate-pulse', className)} />
      }
    >
      <InnerSettlementPostenToggle current={current} className={className} />
    </Suspense>
  )
}
