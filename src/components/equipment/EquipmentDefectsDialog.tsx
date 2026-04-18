'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Equipment, EquipmentInstance } from '@prisma/client'
import { ensureEquipmentInstances, setEquipmentInstanceDefectState } from '@/actions/equipment'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type EquipmentMini = Pick<Equipment, 'id' | 'name' | 'equipmentCode' | 'quantity'> & {
  instances: EquipmentInstance[]
}

const textareaClass =
  'flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50'

function statusLabel(s: string) {
  switch (s) {
    case 'AVAILABLE':
      return 'Verfügbar'
    case 'IN_USE':
      return 'Verliehen'
    case 'MAINTENANCE':
      return 'Reparatur'
    case 'BROKEN':
      return 'Defekt'
    default:
      return s
  }
}

export function EquipmentDefectsDialog({
  equipment,
  open,
  onOpenChange,
}: {
  equipment: EquipmentMini | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [markId, setMarkId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ensuring, setEnsuring] = useState(false)

  const resetDraft = () => {
    setMarkId(null)
    setNoteDraft('')
    setError(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetDraft()
    onOpenChange(next)
  }

  useEffect(() => {
    if (!open || !equipment || equipment.instances.length > 0 || equipment.quantity < 1) {
      return
    }
    let cancelled = false
    setEnsuring(true)
    setError(null)
    void ensureEquipmentInstances(equipment.id).then((res) => {
      if (cancelled) return
      setEnsuring(false)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
    return () => {
      cancelled = true
    }
  }, [open, equipment?.id, equipment?.instances.length, equipment?.quantity, router])

  const submitDefect = async (instanceId: string) => {
    setError(null)
    setBusy(true)
    try {
      const res = await setEquipmentInstanceDefectState({
        instanceId,
        defective: true,
        note: noteDraft,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      resetDraft()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setBusy(false)
    }
  }

  const submitRepair = async (instanceId: string) => {
    setError(null)
    setBusy(true)
    try {
      const res = await setEquipmentInstanceDefectState({
        instanceId,
        defective: false,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {equipment ? (
              <>
                Defekte – {equipment.equipmentCode}{' '}
                <span className="font-normal text-muted-foreground">{equipment.name}</span>
              </>
            ) : (
              'Defekte'
            )}
          </DialogTitle>
        </DialogHeader>
        {ensuring && (
          <p className="text-sm text-muted-foreground">Exemplare werden ergänzt…</p>
        )}
        {!equipment ? null : !ensuring && equipment.instances.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Exemplare erfasst. Bitte Equipment bearbeiten oder erneut anlegen.
          </p>
        ) : equipment.instances.length === 0 ? null : (
          <ul className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {equipment.instances.map((inst) => {
              const isBroken = inst.status === 'BROKEN'
              const isRentBlocked = inst.status === 'IN_USE'
              const showMarkForm = markId === inst.id

              return (
                <li key={inst.id} className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm font-medium">{inst.instanceCode}</span>
                    <Badge
                      variant={
                        isBroken
                          ? 'destructive'
                          : inst.status === 'IN_USE'
                            ? 'default'
                            : inst.status === 'MAINTENANCE'
                              ? 'secondary'
                              : 'outline'
                      }
                    >
                      {statusLabel(inst.status)}
                    </Badge>
                  </div>
                  {inst.serialNumber && (
                    <p className="text-xs text-muted-foreground">S/N: {inst.serialNumber}</p>
                  )}
                  {isBroken && inst.defectNote && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{inst.defectNote}</p>
                  )}
                  {isRentBlocked && (
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      Während einer aktiven Ausleihe nicht änderbar.
                    </p>
                  )}
                  {isBroken ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy || ensuring}
                      onClick={() => void submitRepair(inst.id)}
                    >
                      Wieder einsatzbereit
                    </Button>
                  ) : showMarkForm ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        className={textareaClass}
                        placeholder="Notiz zum Defekt (optional)"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        maxLength={500}
                        rows={3}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={busy || ensuring}
                          onClick={() => void submitDefect(inst.id)}
                        >
                          Als defekt speichern
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy || ensuring}
                          onClick={resetDraft}
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isRentBlocked || busy || ensuring}
                      onClick={() => {
                        setMarkId(inst.id)
                        setNoteDraft('')
                      }}
                    >
                      Als defekt markieren
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
