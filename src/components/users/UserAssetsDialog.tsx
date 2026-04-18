'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Equipment, Location, User } from '@prisma/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Share2 } from 'lucide-react'
import type { UserBalanceDetail } from '@/lib/user-balance'
import { UserBalanceSection } from '@/components/users/UserBalanceSection'

type UserWithAssets = User & {
  locations: Location[]
  equipment: (Equipment & { location: Location | null; owners: { id: string }[] })[]
}

export function UserAssetsDialog({
  user,
  balance,
}: {
  user: UserWithAssets
  balance: UserBalanceDetail
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="w-full text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
              {user.name
                .split(' ')
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <span className="underline-offset-4 hover:underline">{user.name}</span>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{user.name} - Equipment und Lagerorte</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2 overflow-y-auto pr-1 max-h-[70vh]">
          <UserBalanceSection balance={balance} />
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Lagerorte</h3>
              <Badge variant="secondary">{user.locations.length}</Badge>
            </div>
            {user.locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Lagerorte zugewiesen.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {user.locations.map((location) => (
                  <div key={location.id} className="rounded-md border p-3 text-sm bg-muted/20">
                    {location.name}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Equipment</h3>
              <Badge variant="secondary">{user.equipment.length}</Badge>
            </div>
            {user.equipment.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kein Equipment zugewiesen.</p>
            ) : (
              <div className="space-y-2">
                {user.equipment.map((item) => (
                  <Link
                    key={item.id}
                    href={`/equipment/${item.id}`}
                    className="block rounded-md border p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.equipmentCode} - {item.category}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.owners.length > 1 && (
                          <span
                            className="inline-flex items-center text-amber-600"
                            title="Shared-Equipment"
                            aria-label="Shared-Equipment"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <Badge variant="outline">{item.quantity} Stk</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Lagerort: {item.location?.name || 'Kein Lagerort'}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
