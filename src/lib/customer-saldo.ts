/** Summen aus Ausleihen für Anzeige „Saldo“ (ohne Zahlungsbuchung). */
export function computeCustomerSaldoFromRentals(
  rentals: { totalPrice: number; status: string }[]
) {
  let totalNonCancelled = 0
  let openPendingActive = 0

  for (const r of rentals) {
    if (r.status === 'CANCELLED') continue
    totalNonCancelled += r.totalPrice
    if (r.status === 'PENDING' || r.status === 'ACTIVE') {
      openPendingActive += r.totalPrice
    }
  }

  return { totalNonCancelled, openPendingActive }
}
