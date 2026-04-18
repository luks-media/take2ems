'use client'

import { useEffect, useState } from 'react'
import { Location, User } from '@prisma/client'
import { getEquipmentById } from '@/actions/equipment'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EditEquipmentForm, type EquipmentBundlePeerOption } from '@/components/equipment/EditEquipmentForm'

type EquipmentWithRelations = NonNullable<Awaited<ReturnType<typeof getEquipmentById>>>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentId: string | null
  users: User[]
  locations: Location[]
  bundlePeerOptions: EquipmentBundlePeerOption[]
}

export function EditEquipmentDialog({
  open,
  onOpenChange,
  equipmentId,
  users,
  locations,
  bundlePeerOptions,
}: Props) {
  const [equipment, setEquipment] = useState<EquipmentWithRelations | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !equipmentId) {
      setEquipment(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setEquipment(null)

    getEquipmentById(equipmentId)
      .then((data) => {
        if (cancelled) return
        if (!data) {
          setError('Equipment nicht gefunden.')
          setEquipment(null)
        } else {
          setEquipment(data)
        }
      })
      .catch(() => {
        if (!cancelled) setError('Laden fehlgeschlagen.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, equipmentId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-14 text-left">
          <DialogTitle>
            {equipment
              ? `Equipment ${equipment.equipmentCode} bearbeiten`
              : 'Equipment bearbeiten'}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-2">
          {loading && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Wird geladen…
            </div>
          )}
          {error && !loading && (
            <div className="py-12 text-center text-sm text-destructive">{error}</div>
          )}
          {equipment && !loading && (
            <EditEquipmentForm
              key={equipment.id}
              equipment={equipment}
              users={users}
              locations={locations}
              bundlePeerOptions={bundlePeerOptions}
              dismissOnDone={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
