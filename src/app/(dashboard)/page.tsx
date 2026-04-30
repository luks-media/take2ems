import prisma from '@/lib/prisma'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { autoActivateDueRentals, updateRentalStatus } from '@/actions/rental'
import { getSessionUserFromCookies } from '@/lib/session'
import { UserTodoBoard } from '@/components/dashboard/UserTodoBoard'
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
  'flex items-center justify-between p-4 transition-colors duration-200 ease-out motion-reduce:transition-none hover:bg-muted/40'

const quickIconLink =
  'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-background/80 text-foreground shadow-sm transition-all duration-200 ease-out motion-reduce:transition-none hover:-translate-y-0.5 hover:bg-muted/70 hover:shadow-md active:opacity-90'

const quickTooltipBubble =
  'pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover/95 px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 motion-reduce:transition-none'

const kpiCardClass =
  'rounded-2xl border border-border/70 bg-card/90 p-6 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0'

function rentalStatusAccentClass(status: string) {
  if (status === 'ACTIVE') return 'border-l-4 border-l-blue-500/80 dark:border-l-blue-400/80 pl-3'
  if (status === 'PENDING') return 'border-l-4 border-l-amber-500/80 dark:border-l-amber-400/80 pl-3'
  if (status === 'RETURNED') return 'border-l-4 border-l-emerald-500/80 dark:border-l-emerald-400/80 pl-3'
  if (status === 'CANCELLED') return 'border-l-4 border-l-rose-500/80 dark:border-l-rose-400/80 pl-3'
  return 'border-l-4 border-l-muted-foreground/30 pl-3'
}

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
    sessionUser,
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
    getSessionUserFromCookies(),
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
    }),
  ])

  const liveActiveBlockedInstances = liveActiveBlockedAgg._sum?.quantity ?? 0
  const blockedInstances = blockedInstancesAgg._sum?.quantity ?? 0
  const availableInstances = Math.max(rentableInstances - blockedInstances, 0)
  const utilization = rentableInstances > 0 ? Math.round((blockedInstances / rentableInstances) * 100) : 0
  const monthlyRevenue = monthlyRevenueAgg._sum?.totalPrice ?? 0
  const equipmentValue = (await prisma.equipment.findMany({
    select: { quantity: true, purchasePrice: true },
  })).reduce((sum, item) => sum + (item.purchasePrice ?? 0) * item.quantity, 0)
  const myTodos = sessionUser
    ? await prisma.todo.findMany({
        where: {
          OR: [{ userId: sessionUser.id }, { shares: { some: { userId: sessionUser.id } } }],
        },
        orderBy: [{ done: 'asc' }, { createdAt: 'desc' }],
        take: 20,
        select: {
          id: true,
          title: true,
          done: true,
          userId: true,
          user: { select: { name: true } },
          shares: { include: { user: { select: { name: true } } } },
        },
      })
    : []
  const todoShareTargets = sessionUser
    ? await prisma.user.findMany({
        where: { id: { not: sessionUser.id } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
    : []
  const currency = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto space-y-6 p-8 pt-6">
      <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-muted/40 to-background p-6 shadow-sm">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight">Dashboard</h2>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className={kpiCardClass}>
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Package2 className="h-4 w-4" />Equipment</h2>
          <p className="text-3xl font-bold mt-2">{totalEquipment}</p>
          <p className="text-xs text-muted-foreground mt-1">{totalInstances} Instanzen</p>
          <p className="text-xs text-muted-foreground mt-1">{currency.format(equipmentValue)} Gesamtwert</p>
        </Card>
        <Link
          href="/rentals"
          className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card
            className={cn(
              kpiCardClass,
              'h-full cursor-pointer',
              activeRentalCount > 0 && 'border-blue-200/70 bg-blue-50/40 dark:border-blue-900/60 dark:bg-blue-950/20'
            )}
          >
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
        <Card
          className={cn(
            kpiCardClass,
            availableInstances <= 0
              ? 'border-rose-200/70 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20'
              : availableInstances < Math.max(3, Math.ceil(rentableInstances * 0.1))
                ? 'border-amber-200/70 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20'
                : ''
          )}
        >
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Wrench className="h-4 w-4" />Verfügbar</h2>
          <p className="text-3xl font-bold mt-2">{availableInstances}</p>
          <p className="text-xs text-muted-foreground mt-1">{utilization}% Auslastung</p>
        </Card>
        <Card className={kpiCardClass}>
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Euro className="h-4 w-4" />Umsatz (Monat)</h2>
          <p className="text-3xl font-bold mt-2">{monthlyRevenue.toFixed(2)} €</p>
          <p className="text-xs text-muted-foreground mt-1">{format(monthStart, 'MM.yyyy')}</p>
        </Card>
        <Card className={cn(kpiCardClass, overdueRentals.length > 0 && 'border-rose-200/70 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20')}>
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Überfällig</h2>
          <p className="text-3xl font-bold mt-2">{overdueRentals.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{totalUsers} Benutzer im System</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h3 className="mb-4 text-xl font-semibold tracking-tight">Letzte Ausleihen</h3>
          {recentRentals.length === 0 ? (
            <Card className="rounded-2xl p-8 text-center text-muted-foreground shadow-sm">
              Bisher keine Ausleihen vorhanden.
            </Card>
          ) : (
            <Card className="overflow-hidden rounded-2xl border border-border/70 p-0 shadow-sm">
              <div className="flex flex-col">
                {recentRentals.map((rental, i) => (
                  <Link 
                    key={rental.id} 
                    href={`/rentals/${rental.id}`}
                    className={cn(
                      listRowLink,
                      rentalStatusAccentClass(rental.status),
                      i !== recentRentals.length - 1 ? 'border-b' : ''
                    )}
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
          <h3 className="mb-4 text-xl font-semibold tracking-tight">Überfällige Rückgaben</h3>
          {overdueRentals.length === 0 ? (
            <Card className="rounded-2xl p-8 text-center text-muted-foreground shadow-sm">
              Keine überfälligen Ausleihen.
            </Card>
          ) : (
            <Card className="overflow-hidden rounded-2xl border border-border/70 border-l-4 border-l-rose-500/80 p-0 shadow-sm dark:border-l-rose-400/80">
              <div className="flex flex-col">
                {overdueRentals.map((rental, i) => (
                  <div
                    key={rental.id}
                    className={cn(
                      listRowLink,
                      'border-l-4 border-l-rose-500/80 dark:border-l-rose-400/80 pl-3',
                      i !== overdueRentals.length - 1 ? 'border-b' : ''
                    )}
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

      <UserTodoBoard
        initialTodos={myTodos.map((todo) => ({
          id: todo.id,
          title: todo.title,
          done: todo.done,
          ownerName: todo.user.name,
          isOwner: todo.userId === sessionUser?.id,
          sharedWithNames: todo.shares.map((s) => s.user.name),
        }))}
        shareTargets={todoShareTargets}
      />

      <Card className="rounded-2xl border border-border/70 p-4 shadow-sm">
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
