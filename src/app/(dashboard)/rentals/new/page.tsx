import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { getEquipment } from '@/actions/equipment'
import { getRentals } from '@/actions/rental'
import NewRentalClient from '@/components/rentals/NewRentalClient'
import { getAppSettings } from '@/lib/app-settings'
import { rentalStatusReservesInventory } from '@/lib/rental-statuses'
import { decrypt } from '@/actions/auth'

export const dynamic = 'force-dynamic'

async function getCurrentUserId() {
  const token = cookies().get('auth_session')?.value
  if (!token) return null
  try {
    const session = await decrypt(token)
    return typeof session?.user?.id === 'string' ? session.user.id : null
  } catch {
    return null
  }
}

export default async function NewRentalPage() {
  const [equipment, rentals, appSettings, borrowerChoices, defaultBorrowerId] = await Promise.all([
    getEquipment(),
    getRentals(),
    getAppSettings(),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    getCurrentUserId(),
  ])

  // We want to show all equipment, but gray out the ones that are fully booked for the selected dates.
  const instanceCounts = await prisma.equipmentInstance.groupBy({
    by: ['equipmentId'],
    where: {
      status: { notIn: ['BROKEN', 'MAINTENANCE'] }
    },
    _count: { id: true }
  })

  const totalRentableMap: Record<string, number> = {}
  for (const ic of instanceCounts) {
    totalRentableMap[ic.equipmentId] = ic._count.id
  }

  const nextRentalsMap: Record<string, string> = {}
  const now = new Date()
  
  const activeBlocks: { equipmentId: string; startDate: string; endDate: string; quantity: number }[] = []

  for (const rental of rentals) {
    if (rentalStatusReservesInventory(rental.status)) {
      const startDate = new Date(rental.startDate)
      const endDate = new Date(rental.endDate)
      
      for (const item of rental.items) {
        activeBlocks.push({
          equipmentId: item.equipmentId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          quantity: item.quantity
        })
        
        if (startDate > now) {
          const currentNextStr = nextRentalsMap[item.equipmentId]
          const currentNext = currentNextStr ? new Date(currentNextStr) : null
          
          if (!currentNext || startDate < currentNext) {
            nextRentalsMap[item.equipmentId] = startDate.toISOString()
          }
        }
      }
    }
  }

  const defaultRentalStatus =
    appSettings.rentalDefaultStatus === 'ACTIVE' ? 'ACTIVE' : 'PENDING'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-4 shrink-0">
        <h2 className="text-3xl font-bold tracking-tight">Neue Ausleihe</h2>
        <p className="text-muted-foreground">Wähle zuerst das Datum aus, um die Verfügbarkeiten zu prüfen.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
        <NewRentalClient 
          equipment={equipment} 
          nextRentalsMap={nextRentalsMap} 
          totalRentableMap={totalRentableMap}
          activeBlocks={activeBlocks}
          borrowerChoices={borrowerChoices}
          defaultBorrowerId={defaultBorrowerId}
          appPrefs={{
            defaultRentalStatus,
            discountAllowed: appSettings.rentalDiscountAllowed,
            minRentalDays: appSettings.rentalMinDays,
          }}
        />
      </div>
    </div>
  )
}
