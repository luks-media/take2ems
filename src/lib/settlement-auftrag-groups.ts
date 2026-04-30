/** Shape of rentalItemOwnerShare rows from getOwnerSettlement (details). */
export type SettlementShareDetail = {
  id: string
  shareAmount: number
  owner: { name: string }
  originalOwner?: { name: string }
  isReassigned?: boolean
  rentalItem: {
    rentalId: string
    equipment: { name: string }
    rental: {
      customerName: string | null
      startDate: Date
      endDate: Date
      status: string
    }
  }
}

export type AuftragGroupLine = {
  id: string
  ownerName: string
  equipmentName: string
  shareAmount: number
}

export type AuftragGroup = {
  rentalId: string
  customerLabel: string
  startDate: Date
  endDate: Date
  status: string
  lines: AuftragGroupLine[]
  totalAmount: number
}

export function buildAuftragGroups(details: SettlementShareDetail[]): AuftragGroup[] {
  const map = new Map<string, AuftragGroup>()

  for (const d of details) {
    const rid = d.rentalItem.rentalId
    const rental = d.rentalItem.rental
    let g = map.get(rid)
    if (!g) {
      g = {
        rentalId: rid,
        customerLabel: rental.customerName?.trim() || 'Ohne Kundenname',
        startDate: rental.startDate,
        endDate: rental.endDate,
        status: rental.status,
        lines: [],
        totalAmount: 0,
      }
      map.set(rid, g)
    }
    g.lines.push({
      id: d.id,
      ownerName: d.owner.name,
      equipmentName: d.rentalItem.equipment.name,
      shareAmount: d.shareAmount,
    })
    g.totalAmount += d.shareAmount
  }

  return Array.from(map.values()).sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
}
