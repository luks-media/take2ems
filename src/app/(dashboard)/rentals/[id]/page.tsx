import { getRentalById } from '@/actions/rental'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { RentalDetailClient } from '@/components/rentals/RentalDetailClient'

export default async function RentalDetailPage({ params }: { params: { id: string } }) {
  const rental = await getRentalById(params.id)

  if (!rental) {
    notFound()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto space-y-4 p-8 pt-6">
      <div className="flex items-center space-x-2 pb-4">
        <Link href="/rentals">
          <Button variant="outline" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h2 className="text-3xl font-bold tracking-tight">Ausleihe Details</h2>
      </div>
      
      <div className="rounded-md border p-6 max-w-4xl bg-card">
        <RentalDetailClient rental={rental} />
      </div>
    </div>
  )
}
