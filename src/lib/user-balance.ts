import prisma from '@/lib/prisma'

const SETTLEMENT_STATUSES = ['PENDING', 'ACTIVE', 'RETURNED'] as const

export type UserCounterpartyLine = {
  userId: string
  userName: string
  amount: number
}

export type UserBalanceDetail = {
  /** Summe aller Eigentümer-Anteile (Mieteinnahmen) aus relevanten Ausleihen */
  totalOwnerIncome: number
  /** Summe Gesamtpreise, bei denen dieser Nutzer als Mieter geführt ist */
  totalBorrowerExpense: number
  /** totalOwnerIncome - totalBorrowerExpense (positiv = Nettoguthaben) */
  netSaldo: number
  /** Du schuldest anderen Nutzern (anteilig aus deren Eigentümer-Anteilen bei deinen Ausleihen) */
  owedToOthers: UserCounterpartyLine[]
  /** Andere Nutzer schulden dir (ihre Ausleihen, dein Eigentümer-Anteil) */
  owedByOthers: UserCounterpartyLine[]
}

function mergeCounterparty(
  map: Map<string, { userId: string; userName: string; amount: number }>,
  userId: string,
  userName: string,
  delta: number
) {
  if (delta === 0) return
  const prev = map.get(userId)
  if (prev) {
    prev.amount += delta
  } else {
    map.set(userId, { userId, userName, amount: delta })
  }
}

/**
 * Virtuelle Kontostände aus Ausleihen: Mieter zahlt den Gesamtpreis; Eigentümer-Anteile
 * aus RentalItemOwnerShare bestimmen, wer wem wie viel „schuldet“.
 */
export async function getUserBalancesMap(): Promise<Record<string, UserBalanceDetail>> {
  const [rentals, users] = await Promise.all([
    prisma.rental.findMany({
      where: { status: { in: [...SETTLEMENT_STATUSES] } },
      include: {
        user: { select: { id: true, name: true } },
        items: {
          include: {
            ownerShares: {
              include: { owner: { select: { id: true, name: true } } },
            },
          },
        },
      },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ])

  const nameById = new Map(users.map((u) => [u.id, u.name]))

  const totalOwnerIncome = new Map<string, number>()
  const totalBorrowerExpense = new Map<string, number>()
  const owes = new Map<string, Map<string, { userId: string; userName: string; amount: number }>>()

  for (const rental of rentals) {
    const ownerTotals = new Map<string, number>()
    for (const item of rental.items) {
      for (const share of item.ownerShares) {
        const add = share.shareAmount
        ownerTotals.set(share.ownerId, (ownerTotals.get(share.ownerId) || 0) + add)
        totalOwnerIncome.set(share.ownerId, (totalOwnerIncome.get(share.ownerId) || 0) + add)
      }
    }

    const B = rental.userId
    if (B) {
      totalBorrowerExpense.set(B, (totalBorrowerExpense.get(B) || 0) + rental.totalPrice)

      if (!owes.has(B)) {
        owes.set(B, new Map())
      }
      const row = owes.get(B)!

      for (const [O, amt] of Array.from(ownerTotals.entries())) {
        if (O === B) continue
        const oName = nameById.get(O) || 'Unbekannt'
        mergeCounterparty(row, O, oName, amt)
      }
    }
  }

  const allUserIds = new Set<string>()
  for (const u of users) allUserIds.add(u.id)

  const result: Record<string, UserBalanceDetail> = {}

  for (const userId of Array.from(allUserIds)) {
    const income = totalOwnerIncome.get(userId) || 0
    const expense = totalBorrowerExpense.get(userId) || 0
    const netSaldo = income - expense

    const owedToOthersRaw = owes.get(userId) || new Map()
    const owedToOthers = Array.from(owedToOthersRaw.values())
      .filter((l) => l.amount > 0.001)
      .sort((a, b) => b.amount - a.amount)

    const owedByOthers: UserCounterpartyLine[] = []
    for (const [borrowerId, inner] of Array.from(owes.entries())) {
      if (borrowerId === userId) continue
      const line = inner.get(userId)
      if (line && line.amount > 0.001) {
        owedByOthers.push({
          userId: borrowerId,
          userName: nameById.get(borrowerId) || 'Unbekannt',
          amount: line.amount,
        })
      }
    }
    owedByOthers.sort((a, b) => b.amount - a.amount)

    result[userId] = {
      totalOwnerIncome: Number(income.toFixed(2)),
      totalBorrowerExpense: Number(expense.toFixed(2)),
      netSaldo: Number(netSaldo.toFixed(2)),
      owedToOthers: owedToOthers.map((l) => ({ ...l, amount: Number(l.amount.toFixed(2)) })),
      owedByOthers: owedByOthers.map((l) => ({ ...l, amount: Number(l.amount.toFixed(2)) })),
    }
  }

  return result
}
