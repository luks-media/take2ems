'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export type ActivityLogListEntry = {
  id: string
  summary: string
  message: string
  actorName: string
  href: string | null
  changedAtIso: string
  detailsText: string | null
}

export function SettingsActivityLogListClient({ entries }: { entries: ActivityLogListEntry[] }) {
  return (
    <ul className="space-y-1">
      {entries.map((entry) => {
        const changedAt = new Date(entry.changedAtIso)
        return (
          <li key={entry.id}>
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{entry.summary}</span>
                    <span className="block text-xs text-muted-foreground">Von: {entry.actorName}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(changedAt, 'dd.MM.yyyy HH:mm', { locale: de })}
                  </span>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{entry.summary}</DialogTitle>
                  <DialogDescription>
                    {format(changedAt, 'dd.MM.yyyy HH:mm', { locale: de })}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 text-sm">
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Ausgeführt von</div>
                    <div>{entry.actorName}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Änderung</div>
                    <div>{entry.message}</div>
                  </div>

                  {entry.detailsText && (
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Details</div>
                      <div className="whitespace-pre-wrap rounded bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        {entry.detailsText}
                      </div>
                    </div>
                  )}

                  {entry.href && (
                    <div>
                      <Link href={entry.href} className="text-sm text-primary underline-offset-4 hover:underline">
                        Zum Datensatz
                      </Link>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </li>
        )
      })}
    </ul>
  )
}
