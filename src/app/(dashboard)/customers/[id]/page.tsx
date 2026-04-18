import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { computeCustomerSaldoFromRentals } from '@/lib/customer-saldo'
import { CustomerDetailForm } from '@/components/customers/CustomerDetailForm'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      rentals: {
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          totalPrice: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  })

  if (!customer) {
    notFound()
  }

  const { totalNonCancelled, openPendingActive } = computeCustomerSaldoFromRentals(customer.rentals)

  const rentalsSerialized = customer.rentals.map((r) => ({
    id: r.id,
    totalPrice: r.totalPrice,
    status: r.status,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
  }))

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto space-y-6 p-8 pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="w-fit -ml-2 text-muted-foreground" asChild>
            <Link href="/customers" className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              Alle Kunden
            </Link>
          </Button>
          <h2 className="text-3xl font-bold tracking-tight">{customer.name}</h2>
          <p className="text-sm text-muted-foreground">Kontakt-, Rechnungsdaten und Saldo aus Ausleihen.</p>
        </div>
      </div>

      <CustomerDetailForm
        customer={{
          id: customer.id,
          name: customer.name,
          contactPerson: customer.contactPerson,
          email: customer.email,
          phone: customer.phone,
          notes: customer.notes,
          invoiceCompany: customer.invoiceCompany,
          invoiceStreet: customer.invoiceStreet,
          invoiceZip: customer.invoiceZip,
          invoiceCity: customer.invoiceCity,
          invoiceCountry: customer.invoiceCountry,
          invoiceVatId: customer.invoiceVatId,
        }}
        saldoTotal={totalNonCancelled}
        saldoOpen={openPendingActive}
        rentals={rentalsSerialized}
      />
    </div>
  )
}
