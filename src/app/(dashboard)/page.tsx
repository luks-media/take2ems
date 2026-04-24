import prisma from '@/lib/prisma'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { autoActivateDueRentals, updateRentalStatus } from '@/actions/rental'
import {
  AlertTriangle,
  CalendarCheck2,
  Euro,
  Package,
  Package2,
  PlusCircle,
  Receipt,
  Users,
  Wrench,
} from 'lucide-react'

const listRowLink =
  'flex items-center justify-between p-4 transition-colors duration-200 ease-out motion-reduce:transition-none hover:bg-muted/50'

const quickIconLink =
  'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-foreground transition-colors duration-200 ease-out motion-reduce:transition-none hover:bg-muted active:opacity-90'

const quickTooltipBubble =
  'pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 motion-reduce:transition-none'

const kpiCardClass =
  'p-6 rounded-xl hover:shadow-md motion-reduce:hover:shadow-sm'

export const dynamic = 'force-dynamic'

export default async function Home() {
  await autoActivateDueRentals()

  async function markOverdueReturned(formData: FormData) {
    'use server'
    const rentalId = String(formData.get('rentalId') ?? '')
    if (!rentalId) return
    await updateRentalStatus(rentalId, 'RETURNED')
  }

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const liveActiveRentalWhere = {
    status: 'ACTIVE' as const,
    endDate: { gte: now },
  }

  const [
    totalEquipment,
    totalUsers,
    totalInstances,
    rentableInstances,
    maintenanceInstances,
    activeRentalCount,
    liveActiveBlockedAgg,
    overdueRentals,
    monthlyRevenueAgg,
    blockedInstancesAgg,
    recentRentals
  ] = await Promise.all([
    prisma.equipment.count(),
    prisma.user.count(),
    prisma.equipmentInstance.count(),
    prisma.equipmentInstance.count({
      where: { status: { notIn: ['BROKEN', 'MAINTENANCE'] } }
    }),
    prisma.equipmentInstance.count({
      where: { status: { in: ['BROKEN', 'MAINTENANCE'] } }
    }),
    prisma.rental.count({
      where: liveActiveRentalWhere,
    }),
    prisma.rentalItem.aggregate({
      _sum: { quantity: true },
      where: { rental: liveActiveRentalWhere },
    }),
    prisma.rental.findMany({
      where: {
        status: { in: ['PENDING', 'ACTIVE'] },
        endDate: { lt: now }
      },
      orderBy: { endDate: 'asc' },
      take: 5,
      include: { items: true }
    }),
    prisma.rental.aggregate({
      _sum: { totalPrice: true },
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: monthStart, lte: monthEnd }
      }
    }),
    prisma.rentalItem.aggregate({
      _sum: { quantity: true },
      where: {
        rental: {
          status: { in: ['PENDING', 'ACTIVE'] },
          startDate: { lte: now },
          endDate: { gte: now }
        }
      }
    }),
    prisma.rental.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { items: true }
    })
  ])

  const liveActiveBlockedInstances = liveActiveBlockedAgg._sum?.quantity ?? 0
  const blockedInstances = blockedInstancesAgg._sum?.quantity ?? 0
  const availableInstances = Math.max(rentableInstances - blockedInstances, 0)
  const utilization = rentableInstances > 0 ? Math.round((blockedInstances / rentableInstances) * 100) : 0
  const monthlyRevenue = monthlyRevenueAgg._sum?.totalPrice ?? 0

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className={kpiCardClass}>
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Package2 className="h-4 w-4" />Equipment</h2>
          <p className="text-3xl font-bold mt-2">{totalEquipment}</p>
          <p className="text-xs text-muted-foreground mt-1">{totalInstances} Instanzen</p>
        </Card>
        <Link
          href="/rentals"
          className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card className={cn(kpiCardClass, 'h-full cursor-pointer')}>
            <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarCheck2 className="h-4 w-4" />
              Aktive Ausleihen
            </h2>
            <p className="text-3xl font-bold mt-2">{activeRentalCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {liveActiveBlockedInstances} Instanzen aktiv im Zeitraum
            </p>
          </Card>
        </Link>
        <Card className={kpiCardClass}>
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Wrench className="h-4 w-4" />Verfügbar</h2>
          <p className="text-3xl font-bold mt-2">{availableInstances}</p>
          <p className="text-xs text-muted-foreground mt-1">{utilization}% Auslastung</p>
        </Card>
        <Card className={kpiCardClass}>
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Euro className="h-4 w-4" />Umsatz (Monat)</h2>
          <p className="text-3xl font-bold mt-2">{monthlyRevenue.toFixed(2)} €</p>
          <p className="text-xs text-muted-foreground mt-1">{format(monthStart, 'MM.yyyy')}</p>
        </Card>
        <Card className={kpiCardClass}>
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Überfällig</h2>
          <p className="text-3xl font-bold mt-2">{overdueRentals.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{totalUsers} Benutzer im System</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight mb-4">Letzte Ausleihen</h3>
          {recentRentals.length === 0 ? (
            <Card className="p-8 rounded-xl text-center text-muted-foreground">
              Bisher keine Ausleihen vorhanden.
            </Card>
          ) : (
            <Card className="overflow-hidden p-0 rounded-xl">
              <div className="flex flex-col">
                {recentRentals.map((rental, i) => (
                  <Link 
                    key={rental.id} 
                    href={`/rentals/${rental.id}`}
                    className={cn(listRowLink, i !== recentRentals.length - 1 ? 'border-b' : '')}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {rental.customerName || 'Unbekannt'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(rental.startDate), 'dd.MM.yyyy')} - {format(new Date(rental.endDate), 'dd.MM.yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{rental.totalPrice.toFixed(2)} €</p>
                        <p className="text-xs text-muted-foreground">{rental.items.length} Artikel</p>
                      </div>
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
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div>
          <h3 className="text-xl font-bold tracking-tight mb-4">Überfällige Rückgaben</h3>
          {overdueRentals.length === 0 ? (
            <Card className="p-8 rounded-xl text-center text-muted-foreground">
              Keine überfälligen Ausleihen.
            </Card>
          ) : (
            <Card className="overflow-hidden p-0 rounded-xl">
              <div className="flex flex-col">
                {overdueRentals.map((rental, i) => (
                  <div
                    key={rental.id}
                    className={cn(listRowLink, i !== overdueRentals.length - 1 ? 'border-b' : '')}
                  >
                    <div className="min-w-0">
                      <Link href={`/rentals/${rental.id}`} className="block">
                        <p className="text-sm font-medium">{rental.customerName || 'Unbekannt'}</p>
                        <p className="text-xs text-muted-foreground">
                          Ende: {format(new Date(rental.endDate), 'dd.MM.yyyy')}
                        </p>
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">Überfällig</Badge>
                      <form action={markOverdueReturned}>
                        <input type="hidden" name="rentalId" value={rental.id} />
                        <Button
                          type="submit"
                          size="sm"
                          className="bg-black text-white hover:bg-black/90 dark:bg-black dark:text-white dark:hover:bg-black/90"
                        >
                          Zurückgegeben
                        </Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <Card className="p-4 rounded-md">
        <div className="text-sm text-muted-foreground mb-3">Schnellzugriff</div>
        <div className="flex flex-wrap items-end gap-3 pt-1">
          <div className="group relative inline-flex">
            <span className={quickTooltipBubble} role="tooltip">
              Neue Ausleihe
            </span>
            <Link
              href="/rentals/new"
              className={quickIconLink}
              aria-label="Neue Ausleihe"
            >
              <PlusCircle className="h-7 w-7" aria-hidden />
            </Link>
          </div>
          <div className="group relative inline-flex">
            <span className={quickTooltipBubble} role="tooltip">
              Equipment verwalten
            </span>
            <Link
              href="/equipment"
              className={quickIconLink}
              aria-label="Equipment verwalten"
            >
              <Package className="h-7 w-7" aria-hidden />
            </Link>
          </div>
          <div className="group relative inline-flex">
            <span className={quickTooltipBubble} role="tooltip">
              Abrechnung öffnen
            </span>
            <Link
              href="/settlements"
              className={quickIconLink}
              aria-label="Abrechnung öffnen"
            >
              <Receipt className="h-7 w-7" aria-hidden />
            </Link>
          </div>
          <div className="group relative inline-flex">
            <span className={quickTooltipBubble} role="tooltip">
              Benutzer verwalten
            </span>
            <Link
              href="/users"
              className={quickIconLink}
              aria-label="Benutzer verwalten"
            >
              <Users className="h-7 w-7" aria-hidden />
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
