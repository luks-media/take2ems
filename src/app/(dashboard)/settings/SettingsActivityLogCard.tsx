import Link from 'next/link'
import prisma from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { SettingsActivityLogListClient, type ActivityLogListEntry } from './SettingsActivityLogListClient'

type ActivityType = 'all' | 'rentals' | 'equipment' | 'customers' | 'users' | 'system'

type ActivityEntry = {
  id: string
  summary: string
  message: string
  actorName: string
  href: string | null
  changedAt: Date
  type: Exclude<ActivityType, 'all'>
  detailsText: string | null
}

function prettifyDetails(details: string | null): string | null {
  if (!details) return null
  try {
    const parsed = JSON.parse(details)
    if (parsed === null || parsed === undefined) return null
    if (typeof parsed !== 'object') return String(parsed)
    const lines: string[] = []
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        lines.push(`${key}: ${value.map((v) => String(v)).join(', ')}`)
      } else if (value && typeof value === 'object') {
        lines.push(`${key}: ${Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}=${String(v)}`).join(', ')}`)
      } else {
        lines.push(`${key}: ${String(value)}`)
      }
    }
    return lines.join('\n')
  } catch {
    return details
  }
}

function summarizeChange(entityType: string, action: string): string {
  const entity =
    entityType === 'rental'
      ? 'Ausleihe'
      : entityType === 'equipment'
        ? 'Equipment'
        : entityType === 'customer'
          ? 'Kunde'
          : entityType === 'user'
            ? 'Benutzer'
            : 'System'
  const act =
    action === 'create'
      ? 'erstellt'
      : action === 'delete'
        ? 'gelöscht'
        : action === 'update'
          ? 'geändert'
          : action
  return `${entity} ${act}`
}

async function getRecentActivity(): Promise<ActivityEntry[]> {
  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      actor: {
        select: { name: true },
      },
    },
  })

  return logs.map((row) => {
    const type: Exclude<ActivityType, 'all'> =
      row.entityType === 'rental'
        ? 'rentals'
        : row.entityType === 'equipment'
          ? 'equipment'
          : row.entityType === 'customer'
            ? 'customers'
            : row.entityType === 'user'
              ? 'users'
              : 'system'
    const href =
      row.entityType === 'rental' && row.entityId
        ? `/rentals/${row.entityId}`
        : row.entityType === 'equipment' && row.entityId
          ? `/equipment/${row.entityId}`
          : row.entityType === 'customer' && row.entityId
            ? `/customers/${row.entityId}`
            : row.entityType === 'user'
              ? '/users'
              : null
    const actorName = row.actor?.name ?? 'System'
    return {
      id: row.id,
      summary: summarizeChange(row.entityType, row.action),
      message: row.message,
      actorName,
      href,
      changedAt: row.createdAt,
      type,
      detailsText: prettifyDetails(row.details),
    }
  })
}

function normalizeFilter(raw: string | undefined): ActivityType {
  if (raw === 'rentals' || raw === 'equipment' || raw === 'customers' || raw === 'users' || raw === 'system') return raw
  return 'all'
}

function toSingleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function buildFilterHref(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  filter: ActivityType
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams || {})) {
    const single = toSingleValue(value)
    if (!single) continue
    if (key === 'activity') continue
    params.set(key, single)
  }
  if (filter !== 'all') {
    params.set('activity', filter)
  }
  const query = params.toString()
  return query ? `/settings?${query}` : '/settings'
}

export async function SettingsActivityLogCard({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const entries = await getRecentActivity()
  const activeFilter = normalizeFilter(toSingleValue(searchParams?.activity))
  const visibleEntries =
    activeFilter === 'all' ? entries : entries.filter((entry) => entry.type === activeFilter)
  const counts = {
    all: entries.length,
    rentals: entries.filter((entry) => entry.type === 'rentals').length,
    equipment: entries.filter((entry) => entry.type === 'equipment').length,
    customers: entries.filter((entry) => entry.type === 'customers').length,
    users: entries.filter((entry) => entry.type === 'users').length,
    system: entries.filter((entry) => entry.type === 'system').length,
  }
  const chips: Array<{ id: ActivityType; label: string }> = [
    { id: 'all', label: 'Alle' },
    { id: 'rentals', label: 'Ausleihen' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'customers', label: 'Kunden' },
    { id: 'users', label: 'Benutzer' },
    { id: 'system', label: 'System' },
  ]

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow">
      <div className="border-b px-6 py-4">
        <h3 className="text-base font-semibold">Aktivitäts-Log</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Letzte Änderungen an Ausleihen, Equipment, Kunden und Benutzern.
        </p>
      </div>

      <div className="p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
          {chips.map((chip) => (
            <Link
              key={chip.id}
              href={buildFilterHref(searchParams, chip.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                chip.id === activeFilter
                  ? 'border-primary/40 bg-primary text-primary-foreground'
                  : 'border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {chip.label} ({counts[chip.id]})
            </Link>
          ))}
        </div>

        {visibleEntries.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground">Noch keine Eintraege vorhanden.</p>
        ) : (
          <SettingsActivityLogListClient
            entries={visibleEntries.map(
              (entry): ActivityLogListEntry => ({
                id: entry.id,
                summary: entry.summary,
                message: entry.message,
                actorName: entry.actorName,
                href: entry.href,
                changedAtIso: entry.changedAt.toISOString(),
                detailsText: entry.detailsText,
              })
            )}
          />
        )}
      </div>
    </div>
  )
}
