import { getRentals } from '@/actions/rental'
import { RentalsPageShell } from '@/components/rentals/RentalsPageShell'
import type { RentalListRowRental } from '@/components/rentals/RentalListRow'

export const dynamic = 'force-dynamic'

export default async function RentalsPage() {
  const rentals = await getRentals()
  const serialized = JSON.parse(JSON.stringify(rentals)) as RentalListRowRental[]

  return <RentalsPageShell rentals={serialized} />
}
