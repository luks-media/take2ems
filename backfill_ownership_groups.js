const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function uniq(arr) {
  return Array.from(new Set(arr))
}

function ownerIdsFromEquipment(eq) {
  const fromOwners = (eq.owners || []).map((o) => o.id)
  const fromLots = (eq.ownershipLots || []).flatMap((lot) => (lot.shares || []).map((s) => s.ownerId))
  const fromOwnerships = (eq.ownerships || []).map((o) => o.ownerId)
  return uniq([...fromOwners, ...fromLots, ...fromOwnerships])
}

async function run() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true }
  })

  const lukas = users.find((u) => u.name.toLowerCase().includes('lukas'))
  const witiko = users.find((u) => {
    const n = u.name.toLowerCase()
    return n.includes('witiko') || n.includes('wititko')
  })

  if (!lukas || !witiko) {
    throw new Error('Lukas und/oder Witiko konnten nicht gefunden werden.')
  }

  const equipmentList = await prisma.equipment.findMany({
    include: {
      owners: true,
      ownerships: true,
      ownershipLots: { include: { shares: true } }
    }
  })

  let changed = 0
  let skipped = 0

  for (const eq of equipmentList) {
    const ownerIds = ownerIdsFromEquipment(eq)
    if (ownerIds.length === 0) {
      skipped += 1
      console.log(`SKIP ${eq.equipmentCode}: keine Besitzer`)
      continue
    }

    let newLots = []
    let newOwnerIds = ownerIds

    // Regel 1: genau Lukas + Witiko => Shared 50/50 für gesamte Anzahl
    const isExactlyLukasWitiko =
      ownerIds.length === 2 &&
      ownerIds.includes(lukas.id) &&
      ownerIds.includes(witiko.id)

    if (isExactlyLukasWitiko) {
      newOwnerIds = [lukas.id, witiko.id]
      newLots = [
        {
          label: 'Shared 50/50',
          units: eq.quantity,
          shares: [
            { ownerId: lukas.id, fraction: 0.5 },
            { ownerId: witiko.id, fraction: 0.5 }
          ]
        }
      ]
    } else if (ownerIds.length === 1) {
      // Regel 2: Einzel-Besitzer => 100% exklusiv
      newLots = [
        {
          label: 'Exklusiv',
          units: eq.quantity,
          shares: [{ ownerId: ownerIds[0], fraction: 1 }]
        }
      ]
    } else {
      // Fallback: bestehende Lots beibehalten, sonst gleichmäßig über alle Besitzer
      if (eq.ownershipLots.length > 0) {
        newLots = eq.ownershipLots.map((lot) => ({
          label: lot.label || null,
          units: lot.units,
          shares: lot.shares.map((s) => ({ ownerId: s.ownerId, fraction: s.fraction }))
        }))
      } else {
        const equalFraction = 1 / ownerIds.length
        newLots = [
          {
            label: 'Shared (Backfill)',
            units: eq.quantity,
            shares: ownerIds.map((ownerId) => ({ ownerId, fraction: equalFraction }))
          }
        ]
      }
    }

    const ownershipTotals = {}
    for (const lot of newLots) {
      for (const share of lot.shares) {
        ownershipTotals[share.ownerId] = (ownershipTotals[share.ownerId] || 0) + lot.units * share.fraction
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.equipment.update({
        where: { id: eq.id },
        data: {
          owners: { set: newOwnerIds.map((id) => ({ id })) },
          ownerships: {
            deleteMany: {},
            create: Object.entries(ownershipTotals).map(([ownerId, ownedUnits]) => ({
              ownerId,
              ownedUnits
            }))
          },
          ownershipLots: {
            deleteMany: {},
            create: newLots.map((lot) => ({
              label: lot.label,
              units: lot.units,
              shares: {
                create: lot.shares.map((share) => ({
                  ownerId: share.ownerId,
                  fraction: share.fraction
                }))
              }
            }))
          }
        }
      })
    })

    changed += 1
    console.log(`OK ${eq.equipmentCode}: ${newLots.length} Gruppe(n) gesetzt`)
  }

  console.log(`DONE changed=${changed} skipped=${skipped}`)
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
