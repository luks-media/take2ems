export interface OwnerShareInput {
  ownerId: string
  ownedUnits: number
}

export interface OwnerShareResult {
  ownerId: string
  ownedUnitsAtRental: number
  ownerFraction: number
  allocatedQuantity: number
  shareAmount: number
}

function roundTo3(value: number) {
  return Math.round(value * 1000) / 1000
}

export function buildOwnerShares(params: {
  rentalItemTotalPrice: number
  rentedQuantity: number
  equipmentQuantity: number
  ownerShares: OwnerShareInput[]
}): OwnerShareResult[] {
  const { rentalItemTotalPrice, rentedQuantity, equipmentQuantity, ownerShares } = params
  if (ownerShares.length === 0) {
    throw new Error('Keine Besitzer-Anteile für Equipment definiert.')
  }

  const totalOwnedUnits = ownerShares.reduce((sum, share) => sum + share.ownedUnits, 0)
  if (totalOwnedUnits !== equipmentQuantity) {
    throw new Error('Besitzer-Anteile sind inkonsistent zur Gesamtanzahl des Equipments.')
  }

  const rawShares = ownerShares.map((share) => {
    const ownerFraction = share.ownedUnits / equipmentQuantity
    const rawAmount = rentalItemTotalPrice * ownerFraction
    return {
      ownerId: share.ownerId,
      ownedUnitsAtRental: share.ownedUnits,
      ownerFraction,
      allocatedQuantity: roundTo3(rentedQuantity * ownerFraction),
      rawAmount
    }
  })

  const roundedDownCents = rawShares.map((share) => Math.floor(share.rawAmount * 100))
  const totalCents = Math.round(rentalItemTotalPrice * 100)
  const assignedCents = roundedDownCents.reduce((sum, value) => sum + value, 0)
  let remainingCents = totalCents - assignedCents

  const fractionalOrder = rawShares
    .map((share, index) => ({ index, fraction: (share.rawAmount * 100) - roundedDownCents[index] }))
    .sort((a, b) => b.fraction - a.fraction)

  const centsByOwner = [...roundedDownCents]
  let orderIndex = 0
  while (remainingCents > 0 && fractionalOrder.length > 0) {
    const target = fractionalOrder[orderIndex % fractionalOrder.length]
    centsByOwner[target.index] += 1
    remainingCents -= 1
    orderIndex += 1
  }

  return rawShares.map((share, index) => ({
    ownerId: share.ownerId,
    ownedUnitsAtRental: share.ownedUnitsAtRental,
    ownerFraction: share.ownerFraction,
    allocatedQuantity: share.allocatedQuantity,
    shareAmount: centsByOwner[index] / 100
  }))
}

export interface OwnershipLotInput {
  id?: string
  label?: string | null
  units: number
  shares: { ownerId: string; fraction: number }[]
}

export function buildOwnerSharesFromLots(params: {
  rentalItemTotalPrice: number
  rentedQuantity: number
  lots: OwnershipLotInput[]
  borrowerUserId?: string
}): OwnerShareResult[] {
  const { rentalItemTotalPrice, rentedQuantity, lots, borrowerUserId } = params
  if (rentedQuantity <= 0) return []
  if (!lots.length) throw new Error('Keine Besitz-Lose für Equipment definiert.')

  const totalUnits = lots.reduce((sum, lot) => sum + lot.units, 0)
  if (totalUnits <= 0) throw new Error('Besitz-Lose sind ungültig.')

  for (const lot of lots) {
    if (!Number.isInteger(lot.units) || lot.units <= 0) {
      throw new Error('Jedes Besitz-Los braucht eine positive ganze Stückzahl.')
    }
    const fractionSum = lot.shares.reduce((sum, share) => sum + share.fraction, 0)
    if (Math.abs(fractionSum - 1) > 0.001) {
      throw new Error('Die Anteile eines Besitz-Los müssen zusammen 100% ergeben.')
    }
  }

  const pricedPerUnit = rentalItemTotalPrice / rentedQuantity
  const lotsWithPriority = [...lots].sort((a, b) => {
    const borrowerShareA = borrowerUserId ? (a.shares.find((s) => s.ownerId === borrowerUserId)?.fraction || 0) : 0
    const borrowerShareB = borrowerUserId ? (b.shares.find((s) => s.ownerId === borrowerUserId)?.fraction || 0) : 0
    if (borrowerShareA !== borrowerShareB) return borrowerShareB - borrowerShareA
    return b.units - a.units
  })

  let remaining = rentedQuantity
  const ownerBuckets: Record<string, { amount: number; quantity: number; fractionAccumulator: number; occurrences: number; unitsAtRental: number }> = {}

  for (const lot of lotsWithPriority) {
    if (remaining <= 0) break
    const takenFromLot = Math.min(remaining, lot.units)
    remaining -= takenFromLot
    const lotAmount = pricedPerUnit * takenFromLot

    for (const share of lot.shares) {
      if (!ownerBuckets[share.ownerId]) {
        ownerBuckets[share.ownerId] = { amount: 0, quantity: 0, fractionAccumulator: 0, occurrences: 0, unitsAtRental: 0 }
      }
      ownerBuckets[share.ownerId].amount += lotAmount * share.fraction
      ownerBuckets[share.ownerId].quantity += takenFromLot * share.fraction
      ownerBuckets[share.ownerId].fractionAccumulator += share.fraction
      ownerBuckets[share.ownerId].occurrences += 1
      ownerBuckets[share.ownerId].unitsAtRental += takenFromLot * share.fraction
    }
  }

  const owners = Object.entries(ownerBuckets).map(([ownerId, values]) => {
    const averageFraction = values.occurrences > 0 ? values.fractionAccumulator / values.occurrences : 0
    return {
      ownerId,
      ownedUnitsAtRental: roundTo3(values.unitsAtRental),
      ownerFraction: averageFraction,
      allocatedQuantity: roundTo3(values.quantity),
      rawAmount: values.amount
    }
  })

  const roundedDownCents = owners.map((entry) => Math.floor(entry.rawAmount * 100))
  const totalCents = Math.round(rentalItemTotalPrice * 100)
  const assignedCents = roundedDownCents.reduce((sum, value) => sum + value, 0)
  let remainingCents = totalCents - assignedCents

  const fractionalOrder = owners
    .map((entry, index) => ({ index, fraction: (entry.rawAmount * 100) - roundedDownCents[index] }))
    .sort((a, b) => b.fraction - a.fraction)

  const centsByOwner = [...roundedDownCents]
  let orderIndex = 0
  while (remainingCents > 0 && fractionalOrder.length > 0) {
    const target = fractionalOrder[orderIndex % fractionalOrder.length]
    centsByOwner[target.index] += 1
    remainingCents -= 1
    orderIndex += 1
  }

  return owners.map((entry, index) => ({
    ownerId: entry.ownerId,
    ownedUnitsAtRental: entry.ownedUnitsAtRental,
    ownerFraction: entry.ownerFraction,
    allocatedQuantity: entry.allocatedQuantity,
    shareAmount: centsByOwner[index] / 100
  }))
}
