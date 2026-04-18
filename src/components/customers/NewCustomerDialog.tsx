'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCustomer } from '@/actions/customer'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { PlusCircle } from 'lucide-react'

export function NewCustomerDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    try {
      const { id } = await createCustomer({
        name: String(fd.get('name') ?? ''),
        contactPerson: String(fd.get('contactPerson') ?? ''),
        email: String(fd.get('email') ?? ''),
        phone: String(fd.get('phone') ?? ''),
        notes: String(fd.get('notes') ?? ''),
        invoiceCompany: String(fd.get('invoiceCompany') ?? ''),
        invoiceStreet: String(fd.get('invoiceStreet') ?? ''),
        invoiceZip: String(fd.get('invoiceZip') ?? ''),
        invoiceCity: String(fd.get('invoiceCity') ?? ''),
        invoiceCountry: String(fd.get('invoiceCountry') ?? ''),
        invoiceVatId: String(fd.get('invoiceVatId') ?? ''),
      })
      setOpen(false)
      e.currentTarget.reset()
      router.refresh()
      router.push(`/customers/${id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde konnte nicht angelegt werden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Neuer Kunde
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90vh,880px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-1.5 border-b px-6 py-5 pr-12 text-left">
          <DialogTitle>Neuen Kunden anlegen</DialogTitle>
          <DialogDescription>
            Pflicht ist nur der Name. Alle weiteren Felder sind optional und entsprechen der Kundenseite.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              <section className="space-y-3">
                <h4 className="text-sm font-semibold">Stammdaten</h4>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="new-customer-name">Name / Projekt</Label>
                  <Input
                    id="new-customer-name"
                    name="name"
                    required
                    placeholder="z. B. Mustermann GmbH"
                    autoComplete="organization"
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold">Kontakt</h4>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="new-customer-contact">Ansprechpartner</Label>
                    <Input id="new-customer-contact" name="contactPerson" placeholder="Name" autoComplete="name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-customer-email">E-Mail</Label>
                    <Input id="new-customer-email" name="email" type="email" placeholder="mail@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-customer-phone">Telefon</Label>
                    <Input id="new-customer-phone" name="phone" type="tel" placeholder="+49 …" />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold">Rechnungsadresse</h4>
                <Separator />
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-invoice-company">Firma / Name auf der Rechnung</Label>
                    <Input
                      id="new-invoice-company"
                      name="invoiceCompany"
                      placeholder="optional, falls abweichend vom Kundennamen"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-invoice-street">Straße, Hausnummer</Label>
                    <Input id="new-invoice-street" name="invoiceStreet" autoComplete="street-address" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="new-invoice-zip">PLZ</Label>
                      <Input id="new-invoice-zip" name="invoiceZip" autoComplete="postal-code" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="new-invoice-city">Ort</Label>
                      <Input id="new-invoice-city" name="invoiceCity" autoComplete="address-level2" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new-invoice-country">Land</Label>
                      <Input id="new-invoice-country" name="invoiceCountry" placeholder="z. B. Deutschland" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-invoice-vat">USt-IdNr.</Label>
                      <Input id="new-invoice-vat" name="invoiceVatId" placeholder="optional" />
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold">Notizen</h4>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="new-customer-notes">Interne Notizen</Label>
                  <textarea
                    id="new-customer-notes"
                    name="notes"
                    rows={3}
                    placeholder="optional"
                    className={cn(
                      'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                      'ring-offset-background placeholder:text-muted-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      'disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                  />
                </div>
              </section>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>

          <DialogFooter className="border-t px-6 py-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Wird angelegt…' : 'Anlegen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
