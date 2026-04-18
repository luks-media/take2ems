import { getEquipment } from '@/actions/equipment'
import { getLocations } from '@/actions/location'
import { getUsers } from '@/actions/user'
import { NewEquipmentDialog } from '@/components/equipment/NewEquipmentDialog'
import { EquipmentTableClient } from '@/components/equipment/EquipmentTableClient'

export const dynamic = 'force-dynamic'

export default async function EquipmentPage() {
  const [equipment, locations, users] = await Promise.all([
    getEquipment(),
    getLocations(),
    getUsers()
  ])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Equipment</h2>
        <div className="flex items-center gap-2">
          <NewEquipmentDialog locations={locations} users={users} />
        </div>
      </div>

      <EquipmentTableClient equipment={equipment} locations={locations} users={users} />
    </div>
  )
}
