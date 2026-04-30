import { getUsers } from '@/actions/user'
import { getUserBalancesMap } from '@/lib/user-balance'
import { resolveViewMode } from '@/lib/view-mode'
import { NewUserDialog } from '@/components/users/NewUserDialog'
import { UserLocationsDialog } from '@/components/users/UserLocationsDialog'
import { UserProfileDialog } from '@/components/users/UserProfileDialog'
import { UserAssetsDialog } from '@/components/users/UserAssetsDialog'
import { DirectoryViewToggle } from '@/components/layout/DirectoryViewToggle'
import { getSessionUserFromCookies } from '@/lib/session'
import { AdminOnlyButton } from '@/components/common/AdminOnlyButton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Users, Shield, User as UserIcon } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const view = resolveViewMode(searchParams.view, 'list')

  const [users, balanceByUser, sessionUser] = await Promise.all([
    getUsers(),
    getUserBalancesMap(),
    getSessionUserFromCookies(),
  ])
  const isAdmin = sessionUser?.role === 'ADMIN' || sessionUser?.role === 'SUPER_ADMIN'
  const isSuperAdmin = sessionUser?.role === 'SUPER_ADMIN'
  const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
  const equipmentTotalByUser = new Map(
    users.map((user) => [
      user.id,
      user.equipment.reduce((sum, eq) => {
        const unitPrice = eq.purchasePrice ?? 0
        if (unitPrice <= 0) return sum
        let ownedValue = 0
        for (const lot of eq.ownershipLots) {
          const myFraction = lot.shares.find((s) => s.ownerId === user.id)?.fraction ?? 0
          if (myFraction <= 0) continue
          ownedValue += unitPrice * lot.units * myFraction
        }
        return sum + ownedValue
      }, 0),
    ])
  )
  const adminCount = users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length
  const memberCount = users.filter((u) => u.role === 'USER').length

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto space-y-4 p-8 pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Benutzer</h2>
        <div className="flex flex-wrap items-center gap-3">
          <DirectoryViewToggle defaultMode="list" />
          {isAdmin ? (
            <NewUserDialog canManagePrivilegedRoles={isSuperAdmin} />
          ) : (
            <AdminOnlyButton label="Neuen Benutzer anlegen" className="opacity-60" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 hover:shadow-md motion-reduce:hover:shadow-sm">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            Gesamt
          </div>
          <div className="text-2xl font-semibold mt-1">{users.length}</div>
        </Card>
        <Card className="p-4 hover:shadow-md motion-reduce:hover:shadow-sm">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Admins
          </div>
          <div className="text-2xl font-semibold mt-1">{adminCount}</div>
        </Card>
        <Card className="p-4 hover:shadow-md motion-reduce:hover:shadow-sm">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            User
          </div>
          <div className="text-2xl font-semibold mt-1">{memberCount}</div>
        </Card>
      </div>

      {users.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">Keine Benutzer gefunden.</Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users.map((user) => {
            const n = balanceByUser[user.id]?.netSaldo ?? 0
            const equipmentTotal = equipmentTotalByUser.get(user.id) ?? 0
            const saldoCls =
              n > 0.005
                ? 'text-green-700 dark:text-green-400'
                : n < -0.005
                  ? 'text-destructive'
                  : 'text-muted-foreground'
            return (
              <Card key={user.id} className="flex flex-col hover:shadow-md motion-reduce:hover:shadow-sm">
                <CardHeader className="space-y-3 pb-2">
                  <UserAssetsDialog user={user} balance={balanceByUser[user.id]} />
                  <CardDescription className="break-all text-left">{user.email}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <Badge variant={user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' ? 'default' : 'secondary'}>{user.role}</Badge>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Saldo</span>
                    <span className={`font-semibold tabular-nums ${saldoCls}`}>
                      {n > 0 ? '+' : ''}
                      {eur.format(n)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Lagerorte</span>
                    <span className="font-medium tabular-nums">{user.locations.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Equipmentwert</span>
                    <span className="font-medium tabular-nums">{eur.format(equipmentTotal)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Registriert {format(new Date(user.createdAt), 'dd.MM.yyyy')}
                  </p>
                </CardContent>
                <CardFooter className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  {isAdmin ? (
                    <>
                      <UserLocationsDialog user={user} />
                      <UserProfileDialog
                        user={user}
                        balance={balanceByUser[user.id]}
                        canManagePrivilegedRoles={isSuperAdmin}
                      />
                    </>
                  ) : (
                    <AdminOnlyButton label="Nur Admins" size="sm" className="opacity-60" />
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="overflow-hidden p-0 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Lagerorte</TableHead>
                <TableHead>Registriert am</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <UserAssetsDialog user={user} balance={balanceByUser[user.id]} />
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' ? 'default' : 'secondary'}>{user.role}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {(() => {
                      const n = balanceByUser[user.id]?.netSaldo ?? 0
                      const cls =
                        n > 0.005
                          ? 'text-green-700 dark:text-green-400'
                          : n < -0.005
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                      return (
                        <span className={cls}>
                          {n > 0 ? '+' : ''}
                          {eur.format(n)}
                        </span>
                      )
                    })()}
                  </TableCell>
                  <TableCell>{user.locations.length}</TableCell>
                  <TableCell>{format(new Date(user.createdAt), 'dd.MM.yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {isAdmin ? (
                        <>
                          <UserLocationsDialog user={user} />
                          <UserProfileDialog
                            user={user}
                            balance={balanceByUser[user.id]}
                            canManagePrivilegedRoles={isSuperAdmin}
                          />
                        </>
                      ) : (
                        <AdminOnlyButton label="Nur Admins" size="sm" className="opacity-60" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
