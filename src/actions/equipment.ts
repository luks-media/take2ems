'use server'

import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { requireAdmin, requireSessionUser } from '@/lib/session'

/** Bundles mit weniger als zwei Mitgliedern werden aufgelöst (keine sinnvolle Empfehlungsgruppe). */
async function normalizeSingletonRentalBundles(
  tx: Prisma.TransactionClient,
  bundleIds: Iterable<string | null | undefined>
) {
  const unique = Array.from(
    new Set(Array.from(bundleIds, (id) => id).filter((id): id is string => Boolean(id)))
  )
  for (const bundleId of unique) {
    const count = await tx.equipment.count({ where: { rentalBundleId: bundleId } })
    if (count < 2) {
      await tx.equipment.updateMany({
        where: { rentalBundleId: bundleId },
        data: { rentalBundleId: null },
      })
    }
  }
}

interface OwnershipLotInput {
  label?: string
  units: number
  shares: { ownerId: string; fraction: number }[]
}

interface OwnerUnitShareInput {
  ownerId: string
  units: number
}

interface OwnershipGroupInput {
  label?: string
  units: number
  ownerIds: string[]
}

function validateOwnershipLots(quantity: number, ownershipLots?: OwnershipLotInput[]) {
  if (!ownershipLots || ownershipLots.length === 0) return
  const lotUnitsSum = ownershipLots.reduce((sum, lot) => sum + lot.units, 0)
  if (lotUnitsSum !== quantity) {
    throw new Error(`Die Summe der Lot-Stueckzahlen (${lotUnitsSum}) muss exakt der Anzahl (${quantity}) entsprechen.`)
  }

  for (const lot of ownershipLots) {
    if (!Number.isInteger(lot.units) || lot.units <= 0) {
      throw new Error('Jedes Besitz-Los braucht eine positive ganze Stueckzahl.')
    }
    const uniqueOwners = new Set<string>()
    const fractionSum = lot.shares.reduce((sum, share) => {
      if (!share.ownerId) throw new Error('Ungueltige Owner-Zuordnung im Lot.')
      if (share.fraction <= 0) throw new Error('Owner-Anteile im Lot muessen positiv sein.')
      if (uniqueOwners.has(share.ownerId)) throw new Error('Ein Owner darf in einem Lot nur einmal vorkommen.')
      uniqueOwners.add(share.ownerId)
      return sum + share.fraction
    }, 0)
    if (Math.abs(fractionSum - 1) > 0.001) {
      throw new Error('Die Anteile in jedem Lot muessen zusammen 100% ergeben.')
    }
  }
}

function validateOwnerUnitShares(quantity: number, ownerUnitShares?: OwnerUnitShareInput[]) {
  if (!ownerUnitShares || ownerUnitShares.length === 0) return
  const seenOwnerIds = new Set<string>()
  for (const share of ownerUnitShares) {
    if (!share.ownerId) throw new Error('Ungueltiger Owner im Besitzverhaeltnis.')
    if (!Number.isInteger(share.units) || share.units <= 0) {
      throw new Error('Besitzverhaeltnis-Stueckzahlen muessen ganze positive Werte sein.')
    }
    if (seenOwnerIds.has(share.ownerId)) {
      throw new Error('Jeder Owner darf im Besitzverhaeltnis nur einmal vorkommen.')
    }
    seenOwnerIds.add(share.ownerId)
  }
}

function validateOwnershipGroups(quantity: number, ownershipGroups?: OwnershipGroupInput[]) {
  if (!ownershipGroups || ownershipGroups.length === 0) return
  const totalUnits = ownershipGroups.reduce((sum, group) => sum + group.units, 0)
  if (totalUnits > quantity) throw new Error('Die Summe der Shared-Gruppen darf die Gesamtanzahl nicht ueberschreiten.')
  for (const group of ownershipGroups) {
    if (!Number.isInteger(group.units) || group.units <= 0) {
      throw new Error('Gruppen-Stueckzahlen muessen ganze positive Werte sein.')
    }
    if (!group.ownerIds || group.ownerIds.length === 0) {
      throw new Error('Jede Gruppe braucht mindestens einen Besitzer.')
    }
    const uniqueOwnerIds = new Set(group.ownerIds)
    if (uniqueOwnerIds.size !== group.ownerIds.length) {
      throw new Error('Ein Besitzer darf in einer Gruppe nur einmal vorkommen.')
    }
  }
}

function buildLotsFromInputs(params: {
  quantity: number
  ownerUnitShares?: OwnerUnitShareInput[]
  ownershipGroups?: OwnershipGroupInput[]
}) {
  const { quantity, ownerUnitShares = [], ownershipGroups = [] } = params
  validateOwnerUnitShares(quantity, ownerUnitShares)
  validateOwnershipGroups(quantity, ownershipGroups)

  const exclusiveTotal = ownerUnitShares.reduce((sum, share) => sum + share.units, 0)
  const sharedTotal = ownershipGroups.reduce((sum, group) => sum + group.units, 0)
  if (exclusiveTotal + sharedTotal <= 0) {
    throw new Error('Mindestens ein Besitzverhaeltnis oder eine Shared-Gruppe ist erforderlich.')
  }
  if (exclusiveTotal + sharedTotal !== quantity) {
    throw new Error(`Exklusiv (${exclusiveTotal}) + Shared (${sharedTotal}) muss exakt Anzahl (${quantity}) ergeben.`)
  }

  const exclusiveLots: OwnershipLotInput[] = ownerUnitShares.map((share) => ({
    label: `Exklusiv-${share.ownerId}`,
    units: share.units,
    shares: [{ ownerId: share.ownerId, fraction: 1 }]
  }))

  const sharedLots: OwnershipLotInput[] = ownershipGroups.map((group, index) => {
    const fraction = 1 / group.ownerIds.length
    return {
      label: group.label || `Shared ${index + 1}`,
      units: group.units,
      shares: group.ownerIds.map((ownerId) => ({
        ownerId,
        fraction
      }))
    }
  })

  return [...exclusiveLots, ...sharedLots]
}

const EQUIPMENT_INTERNAL_NOTE_MAX = 5000

export async function createEquipment(data: {
  name: string
  description?: string
  internalNote?: string | null
  serialNumber?: string
  category: string
  locationId?: string
  quantity?: number
  purchasePrice?: number
  dailyRate?: number
  status?: string
  ownerIds?: string[]
  ownerUnitShares?: OwnerUnitShareInput[]
  ownershipGroups?: OwnershipGroupInput[]
  ownershipLots?: OwnershipLotInput[]
  ownerShares?: { ownerId: string; ownedUnits: number }[]
}) {
  await requireSessionUser()

  const quantity = data.quantity || 1
  const ownerUnitShares = data.ownerUnitShares || []
  const ownershipGroups = data.ownershipGroups || []
  const ownershipLots = buildLotsFromInputs({ quantity, ownerUnitShares, ownershipGroups })
  const ownerIds = Array.from(new Set(ownershipLots.flatMap((lot) => lot.shares.map((share) => share.ownerId))))

  const categoryMap: Record<string, string> = {
    'Kamera': '1',
    'Licht': '2',
    'Ton': '3',
    'Grip': '4',
    'Production': '5',
    'Misc': '6'
  }
  const catNumber = categoryMap[data.category] || '9'

  const existingEquipment = await prisma.equipment.findMany({
    where: {
      equipmentCode: {
        startsWith: `${catNumber}-`
      }
    },
    select: {
      equipmentCode: true
    }
  })

  const existingNumbers = existingEquipment
    .map(eq => {
      const parts = eq.equipmentCode.split('-')
      return parts.length === 2 ? parseInt(parts[1], 10) : NaN
    })
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b)

  let nextId = 1
  for (const num of existingNumbers) {
    if (num === nextId) {
      nextId++
    } else if (num > nextId) {
      break
    }
  }

  const paddedId = String(nextId).padStart(4, '0')
  const equipmentCode = `${catNumber}-${paddedId}`

  const internalNote =
    typeof data.internalNote === 'string' && data.internalNote.trim().length > 0
      ? data.internalNote.trim().slice(0, EQUIPMENT_INTERNAL_NOTE_MAX)
      : null

  const newEquipment = await prisma.equipment.create({
    data: {
      equipmentCode,
      name: data.name,
      description: data.description,
      internalNote,
      serialNumber: data.serialNumber,
      category: data.category,
      locationId: data.locationId || null,
      quantity,
      purchasePrice: data.purchasePrice,
      dailyRate: data.dailyRate || 0,
      status: data.status || 'AVAILABLE',
      owners: {
        connect: ownerIds.map(id => ({ id }))
      },
      ownerships: {
        create: ownerIds.map((ownerId) => ({
          ownerId,
          ownedUnits: ownershipLots.reduce((sum, lot) => {
            const share = lot.shares.find((s) => s.ownerId === ownerId)
            return sum + (share ? lot.units * share.fraction : 0)
          }, 0)
        }))
      },
      ownershipLots: {
        create: ownershipLots.map((lot) => ({
          label: lot.label || null,
          units: lot.units,
          shares: {
            create: lot.shares.map((share) => ({
              ownerId: share.ownerId,
              fraction: share.fraction
            }))
          }
        }))
      },
      instances: {
        create: Array.from({ length: quantity }).map((_, i) => ({
          instanceCode: `${equipmentCode}-${String(i + 1).padStart(2, '0')}`,
          status: data.status || 'AVAILABLE'
        }))
      }
    },
  })

  revalidatePath('/equipment')
  revalidatePath('/rentals/new')
  revalidatePath('/users')
  return newEquipment
}

export async function getEquipment() {
  await requireSessionUser()
  noStore()
  return prisma.equipment.findMany({
    include: {
      owners: true,
      ownerships: { include: { owner: true } },
      ownershipLots: { include: { shares: { include: { owner: true } } } },
      instances: { orderBy: { instanceCode: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getEquipmentById(id: string) {
  await requireSessionUser()
  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: {
      owners: true,
      ownerships: { include: { owner: true } },
      ownershipLots: { include: { shares: { include: { owner: true } } } },
      instances: { orderBy: { instanceCode: 'asc' } },
    },
  })
  if (!equipment) return null

  const bundleLinkedIds =
    equipment.rentalBundleId === null
      ? []
      : (
          await prisma.equipment.findMany({
            where: { rentalBundleId: equipment.rentalBundleId, NOT: { id } },
            select: { id: true },
          })
        ).map((r) => r.id)

  return { ...equipment, bundleLinkedIds }
}

/** Für Mehrfachauswahl Ausleih-Empfehlungen (ohne schwere Relationen). */
export async function getEquipmentBundlePeerOptions() {
  await requireSessionUser()
  return prisma.equipment.findMany({
    select: { id: true, name: true, equipmentCode: true },
    orderBy: { equipmentCode: 'asc' },
  })
}

/**
 * Verknüpft dieses Equipment mit anderen: gleiche `rentalBundleId` = gemeinsame Empfehlungsgruppe
 * (nur Hinweise bei neuer Ausleihe, keine Pflichtbuchung). `linkedEquipmentIds` ohne das bearbeitete Gerät.
 */
export async function updateEquipmentRentalBundle(
  equipmentId: string,
  linkedEquipmentIds: string[]
) {
  await requireSessionUser()

  const uniqueLinked = Array.from(
    new Set(linkedEquipmentIds.filter((id) => typeof id === 'string' && id.length > 0 && id !== equipmentId))
  )

  const self = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, rentalBundleId: true },
  })
  if (!self) {
    throw new Error('Equipment nicht gefunden.')
  }

  await prisma.$transaction(async (tx) => {
    const oldBundleId = self.rentalBundleId
    const newMemberSet = new Set<string>([equipmentId, ...uniqueLinked])

    const linkedRows =
      uniqueLinked.length > 0
        ? await tx.equipment.findMany({
            where: { id: { in: uniqueLinked } },
            select: { rentalBundleId: true },
          })
        : []

    const bundleIdsToNormalize = new Set<string>()
    if (oldBundleId) bundleIdsToNormalize.add(oldBundleId)
    for (const row of linkedRows) {
      if (row.rentalBundleId) bundleIdsToNormalize.add(row.rentalBundleId)
    }

    if (oldBundleId) {
      const oldMembers = await tx.equipment.findMany({
        where: { rentalBundleId: oldBundleId },
        select: { id: true },
      })
      const toRelease = oldMembers.map((m) => m.id).filter((id) => !newMemberSet.has(id))
      if (toRelease.length > 0) {
        await tx.equipment.updateMany({
          where: { id: { in: toRelease } },
          data: { rentalBundleId: null },
        })
      }
    }

    const allMembers = Array.from(newMemberSet)
    if (allMembers.length < 2) {
      await tx.equipment.update({
        where: { id: equipmentId },
        data: { rentalBundleId: null },
      })
      await normalizeSingletonRentalBundles(tx, bundleIdsToNormalize)
      return
    }

    const newBundleId = randomUUID()
    await tx.equipment.updateMany({
      where: { id: { in: allMembers } },
      data: { rentalBundleId: newBundleId },
    })

    await normalizeSingletonRentalBundles(tx, bundleIdsToNormalize)
  })

  revalidatePath('/equipment')
  revalidatePath('/rentals/new')
  revalidatePath(`/equipment/${equipmentId}`)
}

async function syncEquipmentHeadStatusFromInstances(equipmentId: string) {
  const instances = await prisma.equipmentInstance.findMany({
    where: { equipmentId },
    select: { status: true },
  })
  if (instances.length === 0) return

  let nextStatus: string
  if (instances.some((i) => i.status === 'IN_USE')) {
    nextStatus = 'IN_USE'
  } else if (instances.some((i) => i.status === 'AVAILABLE')) {
    nextStatus = 'AVAILABLE'
  } else if (instances.some((i) => i.status === 'BROKEN')) {
    nextStatus = 'BROKEN'
  } else {
    nextStatus = 'MAINTENANCE'
  }

  await prisma.equipment.update({
    where: { id: equipmentId },
    data: { status: nextStatus },
  })
}

const INSTANCE_DEFECT_NOTE_MAX = 500

/**
 * Exemplar als defekt markieren (nicht verfügbar für neue Ausleihen) oder wieder freigeben.
 * Optional Notiz nur bei Defekt sinnvoll.
 */
export async function setEquipmentInstanceDefectState(input: {
  instanceId: string
  defective: boolean
  note?: string | null
}) {
  await requireSessionUser()

  try {
    const note =
      input.note === null || input.note === undefined
        ? null
        : input.note.trim().slice(0, INSTANCE_DEFECT_NOTE_MAX) || null

    const instance = await prisma.equipmentInstance.findUnique({
      where: { id: input.instanceId },
      select: {
        id: true,
        equipmentId: true,
        status: true,
        rentalItems: {
          select: { rental: { select: { status: true } } },
        },
      },
    })
    if (!instance) {
      return { ok: false as const, error: 'Exemplar nicht gefunden.' }
    }

    const inOpenRental = instance.rentalItems.some(
      (ri) => ri.rental?.status === 'PENDING' || ri.rental?.status === 'ACTIVE'
    )
    if (inOpenRental) {
      return {
        ok: false as const,
        error: 'Exemplar ist in einer aktiven Ausleihe und kann nicht geändert werden.',
      }
    }

    if (input.defective) {
      if (instance.status === 'IN_USE') {
        return { ok: false as const, error: 'Exemplar ist als verliehen markiert.' }
      }
      await prisma.equipmentInstance.update({
        where: { id: instance.id },
        data: { status: 'BROKEN', defectNote: note },
      })
    } else {
      if (instance.status !== 'BROKEN') {
        return { ok: false as const, error: 'Nur defekte Exemplare können wieder freigegeben werden.' }
      }
      await prisma.equipmentInstance.update({
        where: { id: instance.id },
        data: { status: 'AVAILABLE', defectNote: null },
      })
    }

    await syncEquipmentHeadStatusFromInstances(instance.equipmentId)
    revalidatePath('/equipment')
    revalidatePath('/rentals/new')
    revalidatePath('/')
    revalidatePath('/users')
    return { ok: true as const }
  } catch (e) {
    console.error('setEquipmentInstanceDefectState', e)
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : 'Aktion fehlgeschlagen.',
    }
  }
}

/** Legt fehlende EquipmentInstance-Zeilen an (z. B. ältere Daten), bis quantity erreicht ist. */
export async function ensureEquipmentInstances(equipmentId: string) {
  await requireSessionUser()

  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: { id: true, quantity: true, equipmentCode: true },
    })
    if (!equipment) {
      return { ok: false as const, error: 'Equipment nicht gefunden.' }
    }

    const existing = await prisma.equipmentInstance.findMany({
      where: { equipmentId },
      select: { instanceCode: true },
    })
    if (existing.length >= equipment.quantity) {
      return { ok: true as const, created: 0 }
    }

    const maxSuffix = existing.reduce((max, inst) => {
      const parts = inst.instanceCode.split('-')
      const suffix = Number.parseInt(parts[parts.length - 1] || '0', 10)
      return Number.isNaN(suffix) ? max : Math.max(max, suffix)
    }, 0)

    const toCreate = equipment.quantity - existing.length
    for (let i = 1; i <= toCreate; i++) {
      const nextSuffix = String(maxSuffix + i).padStart(2, '0')
      await prisma.equipmentInstance.create({
        data: {
          equipmentId: equipment.id,
          instanceCode: `${equipment.equipmentCode}-${nextSuffix}`,
          status: 'AVAILABLE',
        },
      })
    }

    await syncEquipmentHeadStatusFromInstances(equipmentId)
    revalidatePath('/equipment')
    revalidatePath('/rentals/new')
    return { ok: true as const, created: toCreate }
  } catch (e) {
    console.error('ensureEquipmentInstances', e)
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : 'Exemplare konnten nicht angelegt werden.',
    }
  }
}

export async function updateEquipment(
  id: string,
  data: Partial<{
    name: string
    description: string
    internalNote: string | null
    serialNumber: string
    category: string
    locationId: string
    quantity: number
    purchasePrice: number
    dailyRate: number
    status: string
    ownerIds: string[]
    ownerUnitShares: OwnerUnitShareInput[]
    ownershipGroups: OwnershipGroupInput[]
    ownershipLots: OwnershipLotInput[]
    ownerShares: { ownerId: string; ownedUnits: number }[]
  }>
) {
  await requireSessionUser()

  const { ownerIds, ownerShares, ownershipLots, ownerUnitShares, ownershipGroups, ...rest } = data;
  const current = await prisma.equipment.findUnique({
    where: { id },
    select: {
      quantity: true,
      equipmentCode: true
    }
  })
  const quantity = data.quantity ?? current?.quantity ?? 1
  const normalizedOwnerUnitShares = ownerUnitShares || []
  const normalizedOwnershipGroups = ownershipGroups || []
  const normalizedOwnershipLots = buildLotsFromInputs({
    quantity,
    ownerUnitShares: normalizedOwnerUnitShares,
    ownershipGroups: normalizedOwnershipGroups
  })
  const normalizedOwnerIds = Array.from(new Set(normalizedOwnershipGroups.flatMap((group) => group.ownerIds)))
    .concat(normalizedOwnerUnitShares.map((share) => share.ownerId))
  const uniqueNormalizedOwnerIds = Array.from(new Set(normalizedOwnerIds))

  const updateData: any = { ...rest }
  if (Object.prototype.hasOwnProperty.call(updateData, 'internalNote')) {
    const raw = updateData.internalNote
    updateData.internalNote =
      typeof raw === 'string' && raw.trim().length > 0
        ? raw.trim().slice(0, EQUIPMENT_INTERNAL_NOTE_MAX)
        : null
  }
  if (Object.prototype.hasOwnProperty.call(updateData, 'locationId')) {
    const locationId = updateData.locationId
    delete updateData.locationId
    if (locationId === '' || locationId === null) {
      updateData.location = { disconnect: true }
    } else if (typeof locationId === 'string') {
      updateData.location = { connect: { id: locationId } }
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedEquipment = await tx.equipment.update({
      where: { id },
      data: {
        ...updateData,
        ...((ownerIds !== undefined || ownerShares !== undefined || ownerUnitShares !== undefined || ownershipGroups !== undefined) && {
          owners: {
            set: uniqueNormalizedOwnerIds.map(id => ({ id }))
          }
        }),
        ...((ownerShares !== undefined || ownerUnitShares !== undefined || ownershipGroups !== undefined) && {
          ownerships: {
            deleteMany: {},
            create: uniqueNormalizedOwnerIds.map((ownerId) => ({
              ownerId,
              ownedUnits: normalizedOwnershipLots.reduce((sum, lot) => {
                const share = lot.shares.find((s) => s.ownerId === ownerId)
                return sum + (share ? lot.units * share.fraction : 0)
              }, 0)
            }))
          }
        }),
        ...((ownershipLots !== undefined || ownerUnitShares !== undefined || ownershipGroups !== undefined) && {
          ownershipLots: {
            deleteMany: {},
            create: normalizedOwnershipLots.map((lot) => ({
              label: lot.label || null,
              units: lot.units,
              shares: {
                create: lot.shares.map((share) => ({
                  ownerId: share.ownerId,
                  fraction: share.fraction
                }))
              }
            }))
          },
          ownerships: {
            deleteMany: {},
            create: uniqueNormalizedOwnerIds.map((ownerId) => ({
              ownerId,
              ownedUnits: normalizedOwnershipLots.reduce((sum, lot) => {
                const share = lot.shares.find((s) => s.ownerId === ownerId)
                return sum + (share ? lot.units * share.fraction : 0)
              }, 0)
            }))
          }
        })
      },
      include: {
        ownerships: true,
        ownershipLots: { include: { shares: true } }
      }
    })

    const targetQuantity = typeof data.quantity === 'number' ? data.quantity : (current?.quantity ?? 0)
    const existingInstances = await tx.equipmentInstance.findMany({
      where: { equipmentId: id },
      select: { id: true, instanceCode: true, status: true }
    })

    if (existingInstances.length < targetQuantity) {
      const maxSuffix = existingInstances.reduce((max, inst) => {
        const parts = inst.instanceCode.split('-')
        const suffix = Number.parseInt(parts[parts.length - 1] || '0', 10)
        return Number.isNaN(suffix) ? max : Math.max(max, suffix)
      }, 0)

      const toCreate = targetQuantity - existingInstances.length
      for (let i = 1; i <= toCreate; i++) {
        const nextSuffix = String(maxSuffix + i).padStart(2, '0')
        await tx.equipmentInstance.create({
          data: {
            equipmentId: id,
            instanceCode: `${current?.equipmentCode || '9-0000'}-${nextSuffix}`,
            status: 'AVAILABLE'
          }
        })
      }
    } else if (existingInstances.length > targetQuantity) {
      const removableInstances = await tx.equipmentInstance.findMany({
        where: {
          equipmentId: id,
          status: 'AVAILABLE',
          rentalItems: {
            none: {}
          }
        },
        orderBy: { instanceCode: 'desc' },
        select: { id: true }
      })

      const toRemove = existingInstances.length - targetQuantity
      if (removableInstances.length < toRemove) {
        throw new Error(
          'Anzahl kann nicht reduziert werden, da zu viele Instanzen bereits vermietet oder nicht verfuegbar sind.'
        )
      }

      await tx.equipmentInstance.deleteMany({
        where: {
          id: { in: removableInstances.slice(0, toRemove).map((instance) => instance.id) }
        }
      })
    }

    return updatedEquipment
  })
  
  revalidatePath('/equipment')
  revalidatePath('/rentals/new')
  revalidatePath('/users')
  return updated
}

export async function deleteEquipment(id: string) {
  await requireAdmin()

  try {
    const inUse = await prisma.rentalItem.findFirst({
      where: { equipmentId: id }
    })

    if (inUse) {
      return { success: false, error: 'Equipment kann nicht gelöscht werden, da es bereits in einer Miete verwendet wird.' }
    }

    const toDelete = await prisma.equipment.findUnique({
      where: { id },
      select: { rentalBundleId: true },
    })
    const bundleId = toDelete?.rentalBundleId ?? null

    await prisma.equipment.delete({
      where: { id },
    })

    if (bundleId) {
      const remaining = await prisma.equipment.count({
        where: { rentalBundleId: bundleId },
      })
      if (remaining <= 1) {
        await prisma.equipment.updateMany({
          where: { rentalBundleId: bundleId },
          data: { rentalBundleId: null },
        })
      }
    }
    
    revalidatePath('/equipment')
    revalidatePath('/rentals/new')
    revalidatePath('/users')
    return { success: true }
  } catch (error) {
    console.error('Fehler beim Löschen des Equipments:', error)
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' }
  }
}
