/** Reservieren konkrete Exemplare und blockieren die Verfügbarkeit. */
export function rentalStatusReservesInventory(status: string): boolean {
  return status === 'PENDING' || status === 'ACTIVE'
}

export function isNonBindingRentalStatus(status: string): boolean {
  return status === 'DRAFT' || status === 'QUOTE'
}

export const NON_BINDING_RENTAL_STATUSES = ['DRAFT', 'QUOTE'] as const
