'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { buildOwnerSharesFromLots } from '@/lib/owner-share'
import { isNonBindingRentalStatus, rentalStatusReservesInventory } from '@/lib/rental-statuses'
import { requireAdmin, requireSessionUser } from '@/lib/session'
import { writeActivityLog } from '@/lib/activity-log'

const CREATE_RENTAL_STATUSES = new Set(['PENDING', 'ACTIVE', 'DRAFT'])

/** Dynamisch laden, damit Seiten die nur `getRentals` nutzen nicht `googleapis` bundlen (vermeidet Dev-Chunk-Fehler). */
async function syncRentalCalendarAfterCreateLazy(rentalId: string) {
  const { syncRentalCalendarAfterCreate } = await import('@/lib/google-calendar/rental-sync')
  await syncRentalCalendarAfterCreate(rentalId)
}

async function syncRentalCalendarAfterStatusChangeLazy(rentalId: string) {
  const { syncRentalCalendarAfterStatusChange } = await import('@/lib/google-calendar/rental-sync')
  await syncRentalCalendarAfterStatusChange(rentalId)
}

async function deleteRentalCalendarEventLazy(eventId: string | null) {
  const { deleteRentalCalendarEvent } = await import('@/lib/google-calendar/rental-sync')
  await deleteRentalCalendarEvent(eventId)
}

async function autoActivateDueRentalsCore() {
  const now = new Date()
  const dueRentals = await prisma.rental.findMany({
    where: {
      status: 'PENDING',
      startDate: { lte: now },
    },
    select: {
      id: true,
      items: {
        select: {
          instances: {
            select: { id: true },
          },
        },
      },
    },
  })
  if (dueRentals.length === 0) {
    return 0
  }

  await prisma.$transaction(async (tx) => {
    for (const rental of dueRentals) {
      await tx.rental.update({
        where: { id: rental.id },
        data: { status: 'ACTIVE' },
      })
      const instanceIds = rental.items.flatMap((item) => item.instances.map((inst) => inst.id))
      if (instanceIds.length > 0) {
        await tx.equipmentInstance.updateMany({
          where: { id: { in: instanceIds } },
          data: { status: 'IN_USE' },
        })
      }
    }
  })

  for (const rental of dueRentals) {
    await syncRentalCalendarAfterStatusChangeLazy(rental.id)
    await writeActivityLog({
      actorId: null,
      entityType: 'rental',
      entityId: rental.id,
      action: 'update',
      message: 'Ausleihe automatisch auf Aktiv gesetzt (Startdatum erreicht)',
      details: { from: 'PENDING', to: 'ACTIVE', automatic: true },
    })
  }

  return dueRentals.length
}

export async function autoActivateDueRentals() {
  await requireSessionUser()
  return autoActivateDueRentalsCore()
}

export async function createRental(data: {
  /** Ausgewählter Kunde aus der Datenbank (optional). */
  customerId?: string | null
  customerName?: string
  /** Gesetzt: Bearbeiter (Nutzer). `null` = kein Bearbeiter. `undefined` = Fallback: aktuell angemeldeter Nutzer. */
  borrowerUserId?: string | null
  startDate: Date
  endDate: Date
  totalDays: number
  totalPrice: number
  status?: string
  items: { equipmentId: string; quantity: number; dailyRate: number; totalPrice: number; note?: string | null }[]
}) {
  const sessionUser = await requireSessionUser()

  let resolvedBorrowerId: string | null | undefined
  if (sessionUser.role !== 'ADMIN' && sessionUser.role !== 'SUPER_ADMIN') {
    // USER darf nur sich selbst als Bearbeiter setzen.
    resolvedBorrowerId = sessionUser.id
  } else if (data.borrowerUserId === null) {
    resolvedBorrowerId = null
  } else if (typeof data.borrowerUserId === 'string' && data.borrowerUserId.length > 0) {
    resolvedBorrowerId = data.borrowerUserId
  } else {
    resolvedBorrowerId = sessionUser.id
  }

  const borrowerUserId = resolvedBorrowerId ?? undefined

  const initialStatus =
    data.status && CREATE_RENTAL_STATUSES.has(data.status) ? data.status : 'PENDING'

  const reserveInventory = rentalStatusReservesInventory(initialStatus)

  const rental = await prisma.$transaction(async (tx) => {
    const itemsToCreate = [] as Prisma.RentalItemCreateWithoutRentalInput[]

    for (const item of data.items) {
      const equipment = await tx.equipment.findUnique({
        where: { id: item.equipmentId },
        select: {
          id: true,
          name: true,
          quantity: true,
          ownershipLots: {
            select: {
              id: true,
              label: true,
              units: true,
              shares: {
                select: {
                  ownerId: true,
                  fraction: true,
                },
              },
            },
          },
        },
      })
      if (!equipment) {
        throw new Error(`Equipment nicht gefunden: ${item.equipmentId}`)
      }

      const itemNote =
        typeof item.note === 'string' && item.note.trim().length > 0
          ? item.note.trim().slice(0, 2000)
          : null

      if (!reserveInventory) {
        itemsToCreate.push({
          equipment: { connect: { id: item.equipmentId } },
          quantity: item.quantity,
          dailyRate: item.dailyRate,
          totalPrice: item.totalPrice,
          note: itemNote,
        })
        continue
      }

      const availableInstances = await tx.equipmentInstance.findMany({
        where: {
          equipmentId: item.equipmentId,
          status: { notIn: ['BROKEN', 'MAINTENANCE'] },
          rentalItems: {
            none: {
              rental: {
                status: { in: ['PENDING', 'ACTIVE'] },
                OR: [
                  {
                    startDate: { lte: data.endDate },
                    endDate: { gte: data.startDate },
                  },
                  // Überfällige Rückgaben blockieren Verfügbarkeit bis zur tatsächlichen Rückgabe.
                  {
                    endDate: { lt: new Date() },
                  },
                ],
              },
            },
          },
        },
        take: item.quantity,
      })

      if (availableInstances.length < item.quantity) {
        throw new Error(
          `Nicht genug verfügbare Exemplare für Equipment: ${equipment.name || item.equipmentId} im gewünschten Zeitraum.`
        )
      }

      const instanceIds = availableInstances.map((inst) => ({ id: inst.id }))
      const ownerSharesForItem = buildOwnerSharesFromLots({
        rentalItemTotalPrice: item.totalPrice,
        rentedQuantity: item.quantity,
        lots: equipment.ownershipLots,
        borrowerUserId,
      })

      itemsToCreate.push({
        equipment: { connect: { id: item.equipmentId } },
        quantity: item.quantity,
        dailyRate: item.dailyRate,
        totalPrice: item.totalPrice,
        note: itemNote,
        instances: {
          connect: instanceIds,
        },
        ownerShares: {
          create: ownerSharesForItem.map((s) => ({
            ownerId: s.ownerId,
            ownedUnitsAtRental: s.ownedUnitsAtRental,
            ownerFraction: s.ownerFraction,
            allocatedQuantity: s.allocatedQuantity,
            shareAmount: s.shareAmount,
          })),
        },
      })
    }

    const trimmedCustomerName = data.customerName?.trim() || null
    let resolvedCustomerId: string | null = null
    let resolvedCustomerName: string | null = null

    if (data.customerId) {
      const cust = await tx.customer.findUnique({ where: { id: data.customerId } })
      if (!cust) {
        throw new Error('Kunde nicht gefunden.')
      }
      resolvedCustomerId = cust.id
      resolvedCustomerName = cust.name
    } else if (trimmedCustomerName) {
      const existingRows = await tx.$queryRaw<Array<{ id: string; name: string }>>(
        Prisma.sql`SELECT id, name FROM Customer WHERE LOWER(name) = LOWER(${trimmedCustomerName}) LIMIT 1`
      )
      const existing = existingRows[0]
      if (existing) {
        resolvedCustomerId = existing.id
        resolvedCustomerName = existing.name
      } else {
        const created = await tx.customer.create({
          data: { name: trimmedCustomerName },
        })
        resolvedCustomerId = created.id
        resolvedCustomerName = created.name
      }
    }

    const createdRental = await tx.rental.create({
      data: {
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName,
        userId: resolvedBorrowerId === undefined ? undefined : resolvedBorrowerId,
        startDate: data.startDate,
        endDate: data.endDate,
        totalDays: data.totalDays,
        totalPrice: data.totalPrice,
        status: initialStatus,
        items: {
          create: itemsToCreate
        }
      },
      include: {
        items: {
          include: {
            instances: true
          }
        }
      }
    })

    if (initialStatus === 'ACTIVE') {
      const instanceIds = createdRental.items.flatMap((item) => item.instances.map((i) => i.id))
      if (instanceIds.length > 0) {
        await tx.equipmentInstance.updateMany({
          where: { id: { in: instanceIds } },
          data: { status: 'IN_USE' }
        })
      }
    }

    return createdRental
  });

  revalidatePath('/rentals')
  revalidatePath('/equipment')
  revalidatePath('/users')
  revalidatePath('/customers')

  if (rentalStatusReservesInventory(rental.status)) {
    await syncRentalCalendarAfterCreateLazy(rental.id)
  }

  await writeActivityLog({
    actorId: sessionUser.id,
    entityType: 'rental',
    entityId: rental.id,
    action: 'create',
    message: `Ausleihe erstellt (${rental.status})`,
    details: {
      status: rental.status,
      startDate: rental.startDate,
      endDate: rental.endDate,
      itemCount: rental.items.length,
      totalPrice: rental.totalPrice,
    },
  })

  return rental
}

export async function getRentals() {
  await requireSessionUser()
  await autoActivateDueRentalsCore()

  return prisma.rental.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      customer: { select: { id: true, name: true } },
      items: {
        include: {
          equipment: true,
          ownerShares: {
            include: { owner: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getRentalById(id: string) {
  await requireSessionUser()
  await autoActivateDueRentalsCore()

  return prisma.rental.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      customer: { select: { id: true, name: true } },
      items: {
        include: {
          equipment: true,
          ownerShares: {
            include: { owner: true }
          }
        }
      }
    }
  })
}

export async function updateRentalStatus(id: string, status: string) {
  const sessionUser = await requireSessionUser()
  const oldStatus = (
    await prisma.rental.findUnique({
      where: { id },
      select: { status: true },
    })
  )?.status

  const prev = await prisma.rental.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          instances: true,
          equipment: {
            select: {
              id: true,
              name: true,
              ownershipLots: {
                select: {
                  id: true,
                  label: true,
                  units: true,
                  shares: { select: { ownerId: true, fraction: true } },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!prev) {
    throw new Error('Ausleihe nicht gefunden.')
  }

  const prevNonBinding = isNonBindingRentalStatus(prev.status)
  const nextReserves = rentalStatusReservesInventory(status)

  if (prevNonBinding && nextReserves) {
    await prisma.$transaction(async (tx) => {
      const borrowerUserId = prev.userId ?? undefined

      for (const item of prev.items) {
        if (item.instances.length >= item.quantity) {
          continue
        }

        const equipment = item.equipment
        const availableInstances = await tx.equipmentInstance.findMany({
          where: {
            equipmentId: item.equipmentId,
            status: { notIn: ['BROKEN', 'MAINTENANCE'] },
            rentalItems: {
              none: {
                rental: {
                  status: { in: ['PENDING', 'ACTIVE'] },
                  OR: [
                    {
                      startDate: { lte: prev.endDate },
                      endDate: { gte: prev.startDate },
                    },
                    {
                      endDate: { lt: new Date() },
                    },
                  ],
                },
              },
            },
          },
          take: item.quantity,
        })

        if (availableInstances.length < item.quantity) {
          throw new Error(
            `Nicht genug verfügbare Exemplare für: ${equipment.name}. Passe Zeitraum oder Mengen an.`
          )
        }

        const ownerSharesForItem = buildOwnerSharesFromLots({
          rentalItemTotalPrice: item.totalPrice,
          rentedQuantity: item.quantity,
          lots: equipment.ownershipLots,
          borrowerUserId,
        })

        await tx.rentalItem.update({
          where: { id: item.id },
          data: {
            instances: { connect: availableInstances.map((inst) => ({ id: inst.id })) },
            ownerShares: {
              create: ownerSharesForItem.map((s) => ({
                ownerId: s.ownerId,
                ownedUnitsAtRental: s.ownedUnitsAtRental,
                ownerFraction: s.ownerFraction,
                allocatedQuantity: s.allocatedQuantity,
                shareAmount: s.shareAmount,
              })),
            },
          },
        })
      }

      await tx.rental.update({
        where: { id },
        data: { status },
      })

      if (status === 'ACTIVE') {
        const filled = await tx.rental.findUnique({
          where: { id },
          include: { items: { include: { instances: true } } },
        })
        const instanceIds = filled!.items.flatMap((it) => it.instances.map((i) => i.id))
        if (instanceIds.length > 0) {
          await tx.equipmentInstance.updateMany({
            where: { id: { in: instanceIds } },
            data: { status: 'IN_USE' },
          })
        }
      }
    })
  } else {
    if (isNonBindingRentalStatus(status) && rentalStatusReservesInventory(prev.status)) {
      throw new Error(
        'Von „Ausstehend“ oder „Aktiv“ zurück auf einen Entwurf ist nicht vorgesehen. Nutze „Storniert“ oder lege eine neue Ausleihe an.'
      )
    }

    const rental = await prisma.rental.update({
      where: { id },
      data: { status },
      include: { items: { include: { instances: true } } },
    })

    const instanceIds = rental.items.flatMap((item) => item.instances.map((i) => i.id))

    if (instanceIds.length > 0) {
      if (status === 'RETURNED' || status === 'CANCELLED') {
        await prisma.equipmentInstance.updateMany({
          where: { id: { in: instanceIds } },
          data: { status: 'AVAILABLE' },
        })
      } else if (status === 'ACTIVE') {
        await prisma.equipmentInstance.updateMany({
          where: { id: { in: instanceIds } },
          data: { status: 'IN_USE' },
        })
      }
    }
  }

  revalidatePath('/rentals')
  revalidatePath(`/rentals/${id}`)
  revalidatePath('/')
  revalidatePath('/equipment')
  revalidatePath('/users')
  revalidatePath('/customers')

  await syncRentalCalendarAfterStatusChangeLazy(id)
  await writeActivityLog({
    actorId: sessionUser.id,
    entityType: 'rental',
    entityId: id,
    action: 'update',
    message: `Ausleihe-Status geändert auf ${status}`,
    details: { from: oldStatus ?? null, to: status },
  })

  return getRentalById(id)
}

const RENTAL_ITEM_NOTE_MAX = 2000

export async function updateRentalItems(data: {
  rentalId: string
  items: { equipmentId: string; quantity: number }[]
}) {
  const sessionUser = await requireSessionUser()

  const rental = await prisma.rental.findUnique({
    where: { id: data.rentalId },
    include: {
      items: {
        include: {
          instances: true,
          equipment: {
            select: {
              id: true,
              dailyRate: true,
              ownershipLots: {
                select: {
                  id: true,
                  label: true,
                  units: true,
                  shares: { select: { ownerId: true, fraction: true } },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!rental) {
    throw new Error('Ausleihe nicht gefunden.')
  }

  if (rental.status === 'RETURNED' || rental.status === 'CANCELLED') {
    throw new Error('Zurückgegebene oder stornierte Ausleihen können nicht mehr bearbeitet werden.')
  }

  const uniqueDesired = new Map<string, number>()
  for (const raw of data.items) {
    const equipmentId = raw.equipmentId?.trim()
    const quantity = Math.floor(raw.quantity)
    if (!equipmentId) continue
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new Error('Jede Position muss mindestens Menge 1 haben.')
    }
    if (uniqueDesired.has(equipmentId)) {
      throw new Error('Jeder Artikel darf nur einmal vorkommen.')
    }
    uniqueDesired.set(equipmentId, quantity)
  }
  if (uniqueDesired.size < 1) {
    throw new Error('Mindestens ein Artikel ist erforderlich.')
  }

  const reservingStatus = rentalStatusReservesInventory(rental.status)

  await prisma.$transaction(async (tx) => {
    const existingByEquipment = new Map(rental.items.map((item) => [item.equipmentId, item]))
    const keepInstanceIds = new Set<string>()
    const newItemCreates: Prisma.RentalItemCreateWithoutRentalInput[] = []

    for (const [equipmentId, quantity] of Array.from(uniqueDesired.entries())) {
      const existingItem = existingByEquipment.get(equipmentId)
      const currentInstanceIds = (existingItem?.instances ?? []).map((inst) => inst.id)
      const keepForItem = currentInstanceIds.slice(0, quantity)

      let connectInstanceIds: string[] = []
      if (reservingStatus) {
        const missingCount = quantity - keepForItem.length
        let additionalInstanceIds: string[] = []

        if (missingCount > 0) {
          const additionalInstances = await tx.equipmentInstance.findMany({
            where: {
              equipmentId,
              status: { notIn: ['BROKEN', 'MAINTENANCE'] },
              id: { notIn: keepForItem },
              rentalItems: {
                none: {
                  rental: {
                    id: { not: rental.id },
                    status: { in: ['PENDING', 'ACTIVE'] },
                    OR: [
                      {
                        startDate: { lte: rental.endDate },
                        endDate: { gte: rental.startDate },
                      },
                      {
                        endDate: { lt: new Date() },
                      },
                    ],
                  },
                },
              },
            },
            take: missingCount,
          })
          if (additionalInstances.length < missingCount) {
            throw new Error('Nicht genug verfügbare Exemplare für eine oder mehrere Positionen.')
          }
          additionalInstanceIds = additionalInstances.map((inst) => inst.id)
        }

        connectInstanceIds = [...keepForItem, ...additionalInstanceIds]
        for (const instanceId of connectInstanceIds) {
          keepInstanceIds.add(instanceId)
        }
      }

      const equipment =
        existingItem?.equipment ??
        (await tx.equipment.findUnique({
          where: { id: equipmentId },
          select: {
            id: true,
            dailyRate: true,
            ownershipLots: {
              select: {
                id: true,
                label: true,
                units: true,
                shares: { select: { ownerId: true, fraction: true } },
              },
            },
          },
        }))
      if (!equipment) {
        throw new Error('Ein ausgewählter Artikel wurde nicht gefunden.')
      }

      const dailyRate = existingItem?.dailyRate ?? equipment.dailyRate
      const totalPrice = Number((dailyRate * quantity * rental.totalDays).toFixed(2))
      const ownerSharesForItem = reservingStatus
        ? buildOwnerSharesFromLots({
            rentalItemTotalPrice: totalPrice,
            rentedQuantity: quantity,
            lots: equipment.ownershipLots,
            borrowerUserId: rental.userId ?? undefined,
          })
        : []

      newItemCreates.push({
        equipment: { connect: { id: equipmentId } },
        quantity,
        dailyRate,
        totalPrice,
        note: existingItem?.note ?? null,
        instances: reservingStatus ? { connect: connectInstanceIds.map((id) => ({ id })) } : undefined,
        ownerShares: reservingStatus
          ? {
              create: ownerSharesForItem.map((s) => ({
                ownerId: s.ownerId,
                ownedUnitsAtRental: s.ownedUnitsAtRental,
                ownerFraction: s.ownerFraction,
                allocatedQuantity: s.allocatedQuantity,
                shareAmount: s.shareAmount,
              })),
            }
          : undefined,
      })
    }

    const oldInstanceIds = rental.items.flatMap((item) => item.instances.map((inst) => inst.id))

    await tx.rental.update({
      where: { id: rental.id },
      data: {
        totalPrice: Number(newItemCreates.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)),
        items: {
          deleteMany: {},
          create: newItemCreates,
        },
      },
    })

    const releaseInstanceIds = oldInstanceIds.filter((id) => !keepInstanceIds.has(id))
    if (releaseInstanceIds.length > 0) {
      await tx.equipmentInstance.updateMany({
        where: { id: { in: releaseInstanceIds } },
        data: { status: 'AVAILABLE' },
      })
    }

    if (reservingStatus) {
      const keepIds = Array.from(keepInstanceIds)
      if (rental.status === 'ACTIVE' && keepIds.length > 0) {
        await tx.equipmentInstance.updateMany({
          where: { id: { in: keepIds } },
          data: { status: 'IN_USE' },
        })
      } else if (keepIds.length > 0) {
        await tx.equipmentInstance.updateMany({
          where: { id: { in: keepIds } },
          data: { status: 'AVAILABLE' },
        })
      }
    }
  })

  revalidatePath('/rentals')
  revalidatePath(`/rentals/${rental.id}`)
  revalidatePath('/equipment')
  revalidatePath('/users')
  revalidatePath('/customers')

  await syncRentalCalendarAfterStatusChangeLazy(rental.id)
  await writeActivityLog({
    actorId: sessionUser.id,
    entityType: 'rental',
    entityId: rental.id,
    action: 'update',
    message: 'Ausleihe-Positionen aktualisiert',
    details: {
      itemCount: uniqueDesired.size,
      items: Array.from(uniqueDesired.entries()).map(([equipmentId, quantity]) => ({
        equipmentId,
        quantity,
      })),
    },
  })
  return getRentalById(rental.id)
}

export async function updateRentalItemNote(itemId: string, note: string | null) {
  const sessionUser = await requireSessionUser()

  const row = await prisma.rentalItem.findUnique({
    where: { id: itemId },
    select: { id: true, rentalId: true },
  })
  if (!row) {
    throw new Error('Position nicht gefunden.')
  }
  const trimmed =
    note === null || note === undefined
      ? null
      : note.trim().slice(0, RENTAL_ITEM_NOTE_MAX) || null
  await prisma.rentalItem.update({
    where: { id: itemId },
    data: { note: trimmed },
  })
  revalidatePath('/rentals')
  revalidatePath(`/rentals/${row.rentalId}`)
  await writeActivityLog({
    actorId: sessionUser.id,
    entityType: 'rental',
    entityId: row.rentalId,
    action: 'update',
    message: 'Notiz einer Ausleihe-Position aktualisiert',
    details: { itemId, noteLength: trimmed?.length ?? 0 },
  })
}

/**
 * Verknüpft eine Ausleihe nachträglich mit einem Kunden aus der Datenbank (Name muss exakt passen, Groß-/Kleinschreibung egal).
 */
export async function linkRentalToCustomerByName(rentalId: string) {
  const sessionUser = await requireSessionUser()

  const rental = await prisma.rental.findUnique({
    where: { id: rentalId },
    select: { id: true, customerId: true, customerName: true },
  })
  if (!rental) {
    throw new Error('Ausleihe nicht gefunden.')
  }
  if (rental.customerId) {
    return { linked: false as const, reason: 'already_linked' as const }
  }
  const name = rental.customerName?.trim()
  if (!name) {
    throw new Error('Kein Kundenname an der Ausleihe hinterlegt.')
  }

  const rows = await prisma.$queryRaw<Array<{ id: string; name: string }>>(
    Prisma.sql`SELECT id, name FROM Customer WHERE LOWER(name) = LOWER(${name}) LIMIT 1`
  )
  const customer = rows[0]
  if (!customer) {
    throw new Error(`Kein Kunde „${name}“ in der Datenbank. Lege den Kunden an oder passe den Namen an.`)
  }

  await prisma.rental.update({
    where: { id: rentalId },
    data: {
      customerId: customer.id,
      customerName: customer.name,
    },
  })

  revalidatePath('/rentals')
  revalidatePath(`/rentals/${rentalId}`)
  revalidatePath('/customers')
  await writeActivityLog({
    actorId: sessionUser.id,
    entityType: 'rental',
    entityId: rentalId,
    action: 'update',
    message: `Ausleihe mit Kunde verknüpft: ${customer.name}`,
    details: { customerId: customer.id, customerName: customer.name },
  })
  return { linked: true as const, customerId: customer.id }
}

export async function updateRentalCustomer(data: {
  rentalId: string
  /** Ausgewählter Kunde aus der Datenbank (optional). */
  customerId?: string | null
  /** Freitext; leer = Kunde von der Ausleihe entfernen. */
  customerName?: string
}) {
  const sessionUser = await requireSessionUser()

  const rental = await prisma.rental.findUnique({ where: { id: data.rentalId } })
  if (!rental) {
    throw new Error('Ausleihe nicht gefunden.')
  }

  const trimmedName = data.customerName?.trim() || null
  let resolvedCustomerId: string | null = null
  let resolvedCustomerName: string | null = null

  if (data.customerId) {
    const cust = await prisma.customer.findUnique({ where: { id: data.customerId } })
    if (!cust) {
      throw new Error('Kunde nicht gefunden.')
    }
    resolvedCustomerId = cust.id
    resolvedCustomerName = cust.name
  } else if (trimmedName) {
    const existingRows = await prisma.$queryRaw<Array<{ id: string; name: string }>>(
      Prisma.sql`SELECT id, name FROM Customer WHERE LOWER(name) = LOWER(${trimmedName}) LIMIT 1`
    )
    const existing = existingRows[0]
    if (existing) {
      resolvedCustomerId = existing.id
      resolvedCustomerName = existing.name
    } else {
      const created = await prisma.customer.create({
        data: { name: trimmedName },
      })
      resolvedCustomerId = created.id
      resolvedCustomerName = created.name
    }
  }

  await prisma.rental.update({
    where: { id: data.rentalId },
    data: {
      customerId: resolvedCustomerId,
      customerName: resolvedCustomerName,
    },
  })

  revalidatePath('/rentals')
  revalidatePath(`/rentals/${data.rentalId}`)
  revalidatePath('/customers')

  await syncRentalCalendarAfterStatusChangeLazy(data.rentalId)
  await writeActivityLog({
    actorId: sessionUser.id,
    entityType: 'rental',
    entityId: data.rentalId,
    action: 'update',
    message: `Kunde an Ausleihe aktualisiert: ${resolvedCustomerName ?? 'entfernt'}`,
    details: { customerId: resolvedCustomerId, customerName: resolvedCustomerName },
  })

  return { customerId: resolvedCustomerId, customerName: resolvedCustomerName }
}

export async function deleteRental(id: string) {
  const sessionUser = await requireSessionUser()

  const rental = await prisma.rental.findUnique({
    where: { id },
    include: { items: { include: { instances: true } } }
  })

  if (
    rental &&
    sessionUser.role !== 'ADMIN' &&
    sessionUser.role !== 'SUPER_ADMIN' &&
    rental.userId !== sessionUser.id
  ) {
    throw new Error('Keine Berechtigung.')
  }

  if (rental) {
    const calendarEventId = rental.googleCalendarEventId
    const instanceIds = rental.items.flatMap(item => item.instances.map(i => i.id))

    if (instanceIds.length > 0) {
      await prisma.equipmentInstance.updateMany({
        where: { id: { in: instanceIds } },
        data: { status: 'AVAILABLE' }
      })
    }

    await prisma.rental.delete({
      where: { id }
    })

    await deleteRentalCalendarEventLazy(calendarEventId)
  }

  revalidatePath('/rentals')
  revalidatePath('/equipment')
  revalidatePath('/users')
  revalidatePath('/customers')
  if (rental) {
    await writeActivityLog({
      actorId: sessionUser.id,
      entityType: 'rental',
      entityId: id,
      action: 'delete',
      message: `Ausleihe gelöscht (${rental.status})`,
      details: { status: rental.status, customerName: rental.customerName, totalPrice: rental.totalPrice },
    })
  }
  return rental
}

export async function getOwnerSettlement(startDate?: Date, endDate?: Date) {
  await requireSessionUser()

  const whereClause = {
    rentalItem: {
      rental: {
        status: { in: ['PENDING', 'ACTIVE', 'RETURNED'] },
        ...(startDate || endDate
          ? {
              startDate: startDate ? { gte: startDate } : undefined,
              endDate: endDate ? { lte: endDate } : undefined
            }
          : {})
      }
    }
  }

  const shares = await prisma.rentalItemOwnerShare.findMany({
    where: whereClause,
    include: {
      owner: true,
      rentalItem: {
        include: {
          equipment: true,
          rental: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const totalsByOwner: Record<string, { ownerId: string; ownerName: string; totalAmount: number; shareCount: number }> = {}
  for (const share of shares) {
    if (!totalsByOwner[share.ownerId]) {
      totalsByOwner[share.ownerId] = {
        ownerId: share.ownerId,
        ownerName: share.owner.name,
        totalAmount: 0,
        shareCount: 0
      }
    }
    totalsByOwner[share.ownerId].totalAmount += share.shareAmount
    totalsByOwner[share.ownerId].shareCount += 1
  }

  return {
    totals: Object.values(totalsByOwner).sort((a, b) => b.totalAmount - a.totalAmount),
    details: shares
  }
}
