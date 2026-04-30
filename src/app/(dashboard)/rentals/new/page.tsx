import prisma from '@/lib/prisma'
import { getEquipment } from '@/actions/equipment'
import { getRentalById, getRentals } from '@/actions/rental'
import NewRentalClient from '@/components/rentals/NewRentalClient'
import { getAppSettings } from '@/lib/app-settings'
import { rentalStatusReservesInventory } from '@/lib/rental-statuses'
import { getSessionUserFromCookies } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function NewRentalPage({
  searchParams,
}: {
  searchParams?: { edit?: string }
}) {
  const [equipment, rentals, appSettings, allBorrowerChoices, sessionUser] = await Promise.all([
    getEquipment(),
    getRentals(),
    getAppSettings(),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    getSessionUserFromCookies(),
  ])
  const canSelectBorrower = sessionUser?.role === 'ADMIN' || sessionUser?.role === 'SUPER_ADMIN'
  const defaultBorrowerId = sessionUser?.id ?? null
  const borrowerChoices = canSelectBorrower
    ? allBorrowerChoices
    : allBorrowerChoices.filter((u) => u.id === defaultBorrowerId)

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
  const farFutureIso = '9999-12-31T23:59:59.999Z'
  
  const activeBlocks: { equipmentId: string; startDate: string; endDate: string; quantity: number }[] = []

  for (const rental of rentals) {
    if (rentalStatusReservesInventory(rental.status)) {
      const startDate = new Date(rental.startDate)
      const endDate = new Date(rental.endDate)
      const isOverdueOpen = endDate < now
      const blockEndIso = isOverdueOpen ? farFutureIso : endDate.toISOString()
      
      for (const item of rental.items) {
        activeBlocks.push({
          equipmentId: item.equipmentId,
          startDate: startDate.toISOString(),
          endDate: blockEndIso,
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
  const editRentalId = searchParams?.edit?.trim() || null
  const rentalToEdit = editRentalId ? await getRentalById(editRentalId) : null
  const initialData =
    rentalToEdit && rentalToEdit.status !== 'RETURNED' && rentalToEdit.status !== 'CANCELLED'
      ? {
          startDate: rentalToEdit.startDate.toISOString(),
          endDate: rentalToEdit.endDate.toISOString(),
          customerName: rentalToEdit.customerName ?? '',
          customerId: rentalToEdit.customerId ?? null,
          borrowerNote: rentalToEdit.borrowerNote ?? '',
          borrowerUserId: rentalToEdit.userId ?? null,
          status:
            rentalToEdit.status === 'ACTIVE' || rentalToEdit.status === 'DRAFT'
              ? rentalToEdit.status
              : 'PENDING',
          discountType: rentalToEdit.discountType === 'percent' ? 'percent' as const : 'fixed' as const,
          discountInput: String(rentalToEdit.discountValue ?? 0),
          discountAmount: rentalToEdit.discountAmount ?? 0,
          items: rentalToEdit.items.map((item) => ({
            equipmentId: item.equipmentId,
            quantity: item.quantity,
            note: item.note ?? '',
          })),
        }
      : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-4 shrink-0">
        <h2 className="text-3xl font-bold tracking-tight">
          {editRentalId ? 'Ausleihe vollständig bearbeiten' : 'Neue Ausleihe'}
        </h2>
        <p className="text-muted-foreground">
          Wähle zuerst das Datum aus, um die Verfügbarkeiten zu prüfen.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
        <NewRentalClient 
          equipment={equipment} 
          nextRentalsMap={nextRentalsMap} 
          totalRentableMap={totalRentableMap}
          activeBlocks={activeBlocks}
          borrowerChoices={borrowerChoices}
          defaultBorrowerId={defaultBorrowerId}
          canSelectBorrower={canSelectBorrower}
          appPrefs={{
            defaultRentalStatus,
            discountAllowed: appSettings.rentalDiscountAllowed,
            minRentalDays: appSettings.rentalMinDays,
          }}
          editRentalId={editRentalId ?? undefined}
          initialData={initialData}
        />
      </div>
    </div>
  )
}
