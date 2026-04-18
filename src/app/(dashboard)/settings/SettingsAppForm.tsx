'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import type { AppSettings } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateAppSettingsAction } from '@/actions/settings'

export function SettingsAppForm({ initial }: { initial: AppSettings }) {
  const [pdfCompanyLine, setPdfCompanyLine] = useState(initial.pdfCompanyLine ?? '')
  const [pdfContactLine, setPdfContactLine] = useState(initial.pdfContactLine ?? '')
  const [pdfFooterLine, setPdfFooterLine] = useState(initial.pdfFooterLine ?? '')
  const [rentalDefaultStatus, setRentalDefaultStatus] = useState(initial.rentalDefaultStatus)
  const [rentalDiscountAllowed, setRentalDiscountAllowed] = useState(initial.rentalDiscountAllowed)
  const [rentalMinDays, setRentalMinDays] = useState(String(initial.rentalMinDays))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setPending(true)
    try {
      const fd = new FormData()
      fd.set('pdfCompanyLine', pdfCompanyLine)
      fd.set('pdfContactLine', pdfContactLine)
      fd.set('pdfFooterLine', pdfFooterLine)
      fd.set('rentalDefaultStatus', rentalDefaultStatus)
      fd.set('rentalDiscountAllowed', rentalDiscountAllowed ? 'true' : 'false')
      fd.set('rentalMinDays', rentalMinDays)
      const result = await updateAppSettingsAction(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Speichern fehlgeschlagen.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow">
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-semibold leading-none tracking-tight">PDF-Ausleihliste &amp; neue Ausleihe</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Diese Werte steuern die Ausleihliste-PDF und Standardverhalten bei neuen Ausleihen.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label htmlFor="pdfCompanyLine">Firmenzeile (unter Titel im PDF)</Label>
            <Input
              id="pdfCompanyLine"
              value={pdfCompanyLine}
              onChange={(e) => setPdfCompanyLine(e.target.value)}
              placeholder="z.B. Take Two Media"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdfContactLine">Kontaktzeile (PDF)</Label>
            <Input
              id="pdfContactLine"
              value={pdfContactLine}
              onChange={(e) => setPdfContactLine(e.target.value)}
              placeholder="z.B. Tel. … · mail@…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdfFooterLine">Fusszeile (PDF)</Label>
            <Input
              id="pdfFooterLine"
              value={pdfFooterLine}
              onChange={(e) => setPdfFooterLine(e.target.value)}
              placeholder="z.B. Hinweise zur Rueckgabe …"
            />
          </div>

          <div className="space-y-2">
            <Label>Standard-Status neuer Ausleihen</Label>
            <Select value={rentalDefaultStatus} onValueChange={setRentalDefaultStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Ausstehend</SelectItem>
                <SelectItem value="ACTIVE">Aktiv</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="rentalDiscountAllowed"
              checked={rentalDiscountAllowed}
              onCheckedChange={(v) => setRentalDiscountAllowed(v === true)}
            />
            <Label htmlFor="rentalDiscountAllowed" className="font-normal cursor-pointer">
              Rabatt bei neuer Ausleihe erlauben
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rentalMinDays">Mindest-Miettage</Label>
            <Input
              id="rentalMinDays"
              type="number"
              min={1}
              max={365}
              value={rentalMinDays}
              onChange={(e) => setRentalMinDays(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-700">Gespeichert.</p>}

          <Button type="submit" disabled={pending}>
            {pending ? 'Speichere...' : 'Speichern'}
          </Button>
        </form>
      </div>
    </div>
  )
}
