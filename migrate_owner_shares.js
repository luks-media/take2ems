const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function run() {
  const equipment = await prisma.equipment.findMany({
    include: {
      owners: true,
      ownerships: true,
      ownershipLots: true
    }
  })

  for (const item of equipment) {
    if (item.ownerships.length > 0 && item.ownershipLots.length > 0) continue
    if (!item.owners.length) {
      console.log(`SKIP ${item.equipmentCode}: keine Owner hinterlegt`)
      continue
    }

    const base = Math.floor(item.quantity / item.owners.length)
    let remainder = item.quantity % item.owners.length
    const ownerships = item.owners.map((owner) => {
      const extra = remainder > 0 ? 1 : 0
      if (remainder > 0) remainder -= 1
      return {
        equipmentId: item.id,
        ownerId: owner.id,
        ownedUnits: base + extra
      }
    }).filter((entry) => entry.ownedUnits > 0)

    if (!ownerships.length) {
      console.log(`SKIP ${item.equipmentCode}: konnte keine gueltigen Anteile erzeugen`)
      continue
    }

    if (item.ownerships.length === 0) {
      await prisma.equipmentOwnership.createMany({
        data: ownerships
      })
    }

    if (item.ownershipLots.length === 0) {
      await prisma.equipmentOwnershipLot.create({
        data: {
          equipmentId: item.id,
          label: 'Backfill',
          units: item.quantity,
          shares: {
            create: ownerships.map((entry) => ({
              ownerId: entry.ownerId,
              fraction: entry.ownedUnits / item.quantity
            }))
          }
        }
      })
    }

    console.log(`OK ${item.equipmentCode}: ${ownerships.map((o) => `${o.ownerId}:${o.ownedUnits}`).join(', ')}`)
  }
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
