import { getEquipmentById, getEquipmentBundlePeerOptions } from '@/actions/equipment'
import { getLocations } from '@/actions/location'
import { getUsers } from '@/actions/user'
import { EditEquipmentForm } from '@/components/equipment/EditEquipmentForm'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getSessionUserFromCookies } from '@/lib/session'

export default async function EditEquipmentPage({ params }: { params: { id: string } }) {
  const [equipment, locations, users, bundlePeerOptions, sessionUser] = await Promise.all([
    getEquipmentById(params.id),
    getLocations(),
    getUsers(),
    getEquipmentBundlePeerOptions(),
    getSessionUserFromCookies(),
  ])
  const canDelete = sessionUser?.role === 'ADMIN' || sessionUser?.role === 'SUPER_ADMIN'

  if (!equipment) {
    notFound()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto space-y-4 p-8 pt-6">
      <div className="flex items-center space-x-2 pb-4">
        <Link href="/equipment">
          <Button variant="outline" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h2 className="text-3xl font-bold tracking-tight">Equipment {equipment.equipmentCode} bearbeiten</h2>
      </div>
      
      <div className="rounded-md border p-6 max-w-4xl bg-card">
        <EditEquipmentForm
          equipment={equipment}
          locations={locations}
          users={users}
          bundlePeerOptions={bundlePeerOptions}
          canDelete={canDelete}
        />
      </div>
    </div>
  )
}
