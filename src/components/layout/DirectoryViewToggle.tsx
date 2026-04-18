'use client'

import { Suspense, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DirectoryViewMode } from '@/lib/view-mode'
import { resolveViewMode } from '@/lib/view-mode'

function InnerDirectoryViewToggle({
  defaultMode,
  className,
}: {
  defaultMode: DirectoryViewMode
  className?: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const mode = resolveViewMode(searchParams.get('view') ?? undefined, defaultMode)

  const { hrefGrid, hrefList } = useMemo(() => {
    const gridParams = new URLSearchParams(searchParams.toString())
    const listParams = new URLSearchParams(searchParams.toString())

    if (defaultMode === 'grid') {
      gridParams.delete('view')
      listParams.set('view', 'list')
    } else {
      listParams.delete('view')
      gridParams.set('view', 'grid')
    }

    const qGrid = gridParams.toString()
    const qList = listParams.toString()
    return {
      hrefGrid: qGrid ? `${pathname}?${qGrid}` : pathname,
      hrefList: qList ? `${pathname}?${qList}` : pathname,
    }
  }, [defaultMode, pathname, searchParams])

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border bg-muted/30 p-0.5 transition-[box-shadow,background-color] duration-200 ease-out motion-reduce:transition-none',
        className
      )}
      role="group"
      aria-label="Darstellung wechseln"
    >
      <Button
        asChild
        variant="ghost"
        size="sm"
        className={cn('h-8 gap-1.5 px-2.5', mode === 'grid' && 'bg-background shadow-sm')}
      >
        <Link href={hrefGrid} scroll={false} aria-current={mode === 'grid' ? 'true' : undefined}>
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden sm:inline">Kacheln</span>
        </Link>
      </Button>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className={cn('h-8 gap-1.5 px-2.5', mode === 'list' && 'bg-background shadow-sm')}
      >
        <Link href={hrefList} scroll={false} aria-current={mode === 'list' ? 'true' : undefined}>
          <List className="h-4 w-4" />
          <span className="hidden sm:inline">Liste</span>
        </Link>
      </Button>
    </div>
  )
}

export function DirectoryViewToggle(props: { defaultMode: DirectoryViewMode; className?: string }) {
  return (
    <Suspense
      fallback={
        <div
          className={cn('h-9 w-[7.5rem] rounded-md border bg-muted/20 animate-pulse', props.className)}
        />
      }
    >
      <InnerDirectoryViewToggle {...props} />
    </Suspense>
  )
}
