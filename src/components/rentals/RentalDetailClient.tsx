'use client'

import { Fragment, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  updateRentalStatus,
  deleteRental,
  linkRentalToCustomerByName,
  updateRentalCustomer,
  updateRentalItemNote,
  getSettlementTransferUsers,
  reassignOwnerShareForSettlement,
} from '@/actions/rental'
import { searchCustomers, type CustomerSearchHit } from '@/actions/customer'
import { Equipment, Rental, RentalItem, RentalItemOwnerShare, User } from '@prisma/client'
import { FileDown, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EquipmentCategoryIcon } from '@/lib/equipment-category-icon'
import { isNonBindingRentalStatus } from '@/lib/rental-statuses'

function RentalItemNoteField({
  itemId,
  initialNote,
}: {
  itemId: string
  initialNote: string | null
}) {
  const router = useRouter()
  const [value, setValue] = useState(initialNote ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(initialNote ?? '')
  }, [initialNote, itemId])

  async function save() {
    const next = value.trim() || null
    const prev = (initialNote ?? '').trim() || null
    if (next === prev) return
    setSaving(true)
    try {
      await updateRentalItemNote(itemId, value)
      router.refresh()
    } catch (e) {
      console.error(e)
      alert('Notiz konnte nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <textarea
      className={cn(
        'min-h-[52px] w-full max-w-[280px] rounded-md border border-input bg-background px-2 py-1.5 text-sm',
        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        saving && 'opacity-60'
      )}
      placeholder="Notiz…"
      maxLength={2000}
      rows={2}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void save()}
    />
  )
}

type RentalWithItems = Rental & {
  discountAmount?: number | null
  discountType?: string | null
  discountValue?: number | null
  user: { id: string; name: string; email: string } | null
  customer: { id: string; name: string } | null
  items: (RentalItem & {
    equipment: Equipment
    ownerShares: (RentalItemOwnerShare & {
      owner: User
      settlementOwner: User | null
      settlementReason: string | null
    })[]
  })[]
}

export function RentalDetailClient({
  rental,
  canDelete,
  canManageSettlement,
}: {
  rental: RentalWithItems
  canDelete: boolean
  canManageSettlement: boolean
}) {
  const router = useRouter()
  const baseTotal = rental.items.reduce((sum, item) => sum + item.dailyRate * item.quantity * rental.totalDays, 0)
  const discountAmount = Math.max(
    0,
    Number(((rental.discountAmount ?? baseTotal - rental.totalPrice) || 0).toFixed(2))
  )
  const discountPercent = baseTotal > 0 ? Number(((discountAmount / baseTotal) * 100).toFixed(2)) : 0
  const ownerShareTotals = (() => {
    const totals = new Map<
      string,
      { ownerId: string; ownerName: string; amount: number; allocatedQuantity: number }
    >()
    for (const item of rental.items) {
      for (const share of item.ownerShares) {
        const effectiveOwnerId = share.settlementOwner?.id ?? share.ownerId
        const effectiveOwnerName = share.settlementOwner?.name ?? share.owner.name
        const existing = totals.get(effectiveOwnerId)
        if (existing) {
          existing.amount += share.shareAmount
          existing.allocatedQuantity += share.allocatedQuantity
        } else {
          totals.set(effectiveOwnerId, {
            ownerId: effectiveOwnerId,
            ownerName: effectiveOwnerName,
            amount: share.shareAmount,
            allocatedQuantity: share.allocatedQuantity,
          })
        }
      }
    }
    return Array.from(totals.values()).sort((a, b) => b.amount - a.amount)
  })()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLinkingCustomer, setIsLinkingCustomer] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  const [editingCustomer, setEditingCustomer] = useState(false)
  const [custName, setCustName] = useState('')
  const [custSelId, setCustSelId] = useState<string | null>(null)
  const [custSuggest, setCustSuggest] = useState<CustomerSearchHit[]>([])
  const [custSuggestOpen, setCustSuggestOpen] = useState(false)
  const [custSaving, setCustSaving] = useState(false)
  const [custFormErr, setCustFormErr] = useState<string | null>(null)
  const [transferUsers, setTransferUsers] = useState<Array<{ id: string; name: string }>>([])
  const [shareTargetById, setShareTargetById] = useState<Record<string, string>>({})
  const [shareSavingById, setShareSavingById] = useState<Record<string, boolean>>({})
  const [showSettlementReassignUi, setShowSettlementReassignUi] = useState(false)
  const deleteDeniedMessage = 'Nur Administratoren oder der Ausleiher dürfen löschen.'
  const canEditRentalItems = rental.status !== 'RETURNED' && rental.status !== 'CANCELLED'

  function openCustomerEdit() {
    setCustName(rental.customerName || '')
    setCustSelId(rental.customer?.id ?? null)
    setCustSuggest([])
    setCustFormErr(null)
    setCustSuggestOpen(false)
    setEditingCustomer(true)
  }

  function cancelCustomerEdit() {
    setEditingCustomer(false)
    setCustSuggestOpen(false)
    setCustFormErr(null)
  }

  useEffect(() => {
    if (!editingCustomer) return
    const q = custName.trim()
    if (q.length < 1) {
      setCustSuggest([])
      return
    }
    const t = window.setTimeout(() => {
      void searchCustomers(q).then(setCustSuggest).catch(() => setCustSuggest([]))
    }, 200)
    return () => window.clearTimeout(t)
  }, [custName, editingCustomer])

  useEffect(() => {
    if (!canManageSettlement) return
    void getSettlementTransferUsers()
      .then((rows) => {
        setTransferUsers(rows)
      })
      .catch(() => {
        setTransferUsers([])
      })
  }, [canManageSettlement])

  async function handleSaveCustomer() {
    setCustFormErr(null)
    setCustSaving(true)
    try {
      await updateRentalCustomer({
        rentalId: rental.id,
        customerId: custSelId ?? undefined,
        customerName: custName,
      })
      setEditingCustomer(false)
      router.refresh()
    } catch (e: unknown) {
      setCustFormErr(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setCustSaving(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (newStatus === rental.status) return
    setIsUpdating(true)
    try {
      await updateRentalStatus(rental.id, newStatus)
      router.refresh()
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Fehler beim Aktualisieren des Status.')
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Möchtest du diese Ausleihe wirklich löschen?')) return
    setIsDeleting(true)
    try {
      await deleteRental(rental.id)
      router.push('/rentals')
    } catch (error) {
      console.error(error)
      alert('Fehler beim Löschen.')
      setIsDeleting(false)
    }
  }

  async function handleLinkCustomer() {
    setLinkError(null)
    setIsLinkingCustomer(true)
    try {
      await linkRentalToCustomerByName(rental.id)
      router.refresh()
    } catch (e: unknown) {
      setLinkError(e instanceof Error ? e.message : 'Verknüpfung fehlgeschlagen.')
    } finally {
      setIsLinkingCustomer(false)
    }
  }

  async function handleSettlementReassign(shareId: string, fallbackOwnerId: string) {
    const raw = shareTargetById[shareId]
    const target = raw && raw !== '__ORIGINAL__' ? raw : fallbackOwnerId
    setShareSavingById((prev) => ({ ...prev, [shareId]: true }))
    try {
      await reassignOwnerShareForSettlement({
        shareId,
        targetOwnerId: target,
      })
      router.refresh()
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Umbuchung fehlgeschlagen.')
    } finally {
      setShareSavingById((prev) => ({ ...prev, [shareId]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Kunde / Projekt</h3>
            {editingCustomer ? (
              <div className="space-y-3 rounded-md border bg-muted/20 p-4">
                <div className="relative space-y-2">
                  <Label htmlFor="rental-customer-edit">Name / Projekt</Label>
                  <Input
                    id="rental-customer-edit"
                    autoComplete="off"
                    value={custName}
                    onChange={(e) => {
                      setCustName(e.target.value)
                      setCustSelId(null)
                      setCustSuggestOpen(true)
                    }}
                    onFocus={() => setCustSuggestOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setCustSuggestOpen(false), 180)
                    }}
                    placeholder="Kunde suchen oder neuen Namen eingeben"
                  />
                  {custSuggestOpen && custSuggest.length > 0 && (
                    <ul
                      className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
                      role="listbox"
                    >
                      {custSuggest.map((hit) => (
                        <li key={hit.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setCustName(hit.name)
                              setCustSelId(hit.id)
                              setCustSuggest([])
                              setCustSuggestOpen(false)
                            }}
                          >
                            {hit.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Vorschlag wählen oder neuen Namen speichern (legt ggf. einen Kunden an). Feld leer speichern
                  entfernt den Kunden von dieser Ausleihe.
                </p>
                {custFormErr && <p className="text-sm text-destructive">{custFormErr}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={handleSaveCustomer} disabled={custSaving}>
                    {custSaving ? 'Speichern…' : 'Übernehmen'}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={cancelCustomerEdit} disabled={custSaving}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : rental.customer ? (
              <div className="space-y-2">
                <p className="text-lg font-medium">{rental.customerName || rental.customer.name}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="link" className="h-auto p-0 text-primary" asChild>
                    <Link href={`/customers/${rental.customer.id}`} className="inline-flex items-center gap-1 text-sm">
                      Zur Kundendatenbank
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={openCustomerEdit}>
                    Kunde ändern
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-medium">{rental.customerName || '—'}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={openCustomerEdit}>
                    Kunde zuweisen
                  </Button>
                  {rental.customerName?.trim() && (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleLinkCustomer}
                        disabled={isLinkingCustomer}
                      >
                        {isLinkingCustomer ? 'Wird verknüpft…' : 'Nur per Namen verknüpfen'}
                      </Button>
                      {linkError && <p className="text-xs text-destructive w-full">{linkError}</p>}
                    </>
                  )}
                </div>
                {rental.customerName?.trim() && (
                  <p className="text-xs text-muted-foreground">
                    „Nur per Namen verknüpfen“, wenn der Text exakt einem Kunden entspricht. Sonst „Kunde
                    zuweisen“ nutzen.
                  </p>
                )}
              </div>
            )}
            <div className="mt-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Bearbeiter</h3>
              <p className="text-base">
                {rental.user ? (
                  <span>{rental.user.name}</span>
                ) : (
                  <span className="text-muted-foreground">Kein Nutzer verknüpft</span>
                )}
              </p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Zeitraum</h3>
            <p>
              {format(new Date(rental.startDate), 'dd.MM.yyyy', { locale: de })} -{' '}
              {format(new Date(rental.endDate), 'dd.MM.yyyy', { locale: de })} ({rental.totalDays} Tage)
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Preisübersicht</h3>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Originalpreis: {baseTotal.toFixed(2)} €</p>
              <p className="text-sm text-muted-foreground">
                Rabatt: -{discountAmount.toFixed(2)} € ({discountPercent.toFixed(2)}%)
              </p>
              <p className="text-lg font-bold">Gesamtpreis: {rental.totalPrice.toFixed(2)} €</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {isNonBindingRentalStatus(rental.status) && (
            <div className="rounded-md border border-amber-200/90 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-50">
              Noch <strong>keine Exemplare reserviert</strong>. Status auf <strong>Ausstehend</strong> oder{' '}
              <strong>Aktiv</strong> setzen, um verfügbare Stücke zuzuweisen (Bestand wird dann geprüft).
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Status</h3>
            <Select value={rental.status} onValueChange={handleStatusChange} disabled={isUpdating}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Entwurf</SelectItem>
                <SelectItem value="PENDING">Ausstehend</SelectItem>
                <SelectItem value="ACTIVE">Aktiv</SelectItem>
                <SelectItem value="RETURNED">Zurückgegeben</SelectItem>
                <SelectItem value="CANCELLED">Storniert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">ID</h3>
            <p className="text-xs font-mono text-muted-foreground">{rental.id}</p>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Ausgeliehenes Equipment</h3>
          {canManageSettlement ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowSettlementReassignUi((prev) => !prev)}
            >
              {showSettlementReassignUi ? 'Umbuchung ausblenden' : 'Umbuchung einblenden'}
            </Button>
          ) : null}
        </div>
        <div className="rounded-md border bg-card text-card-foreground shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Artikel</TableHead>
                <TableHead>Anzahl</TableHead>
                <TableHead>Notiz</TableHead>
                <TableHead>S/N</TableHead>
                <TableHead>Tagespreis</TableHead>
                <TableHead>Gesamt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rental.items.map((item) => (
                <Fragment key={item.id}>
                  <TableRow>
                    <TableCell className="font-mono text-xs">{item.equipment.equipmentCode}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-start gap-2">
                        <EquipmentCategoryIcon
                          category={item.equipment.category}
                          className="mt-0.5 h-4 w-4 text-muted-foreground"
                        />
                        <div className="min-w-0">
                          <div>{item.equipment.name}</div>
                          {item.equipment.internalNote?.trim() && (
                            <div className="mt-1 text-xs font-normal italic text-muted-foreground whitespace-pre-wrap">
                              Artikel-Notiz: {item.equipment.internalNote}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell className="align-top">
                      <RentalItemNoteField itemId={item.id} initialNote={item.note} />
                    </TableCell>
                    <TableCell>{item.equipment.serialNumber || '-'}</TableCell>
                    <TableCell>{`${item.dailyRate.toFixed(2)} €`}</TableCell>
                    <TableCell>{`${item.totalPrice.toFixed(2)} €`}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} className="bg-muted/20">
                      <div className="space-y-1 text-sm">
                        <div className="font-medium">Owner-Anteile</div>
                        {item.ownerShares.length === 0 ? (
                          <div className="text-xs text-muted-foreground">Keine Anteile gespeichert.</div>
                        ) : (
                          item.ownerShares.map((share) => (
                            <div key={share.id} className="flex items-center justify-between">
                              <div className="min-w-0">
                                <div>
                                  {share.owner.name} ({share.ownedUnitsAtRental} Stk, {(share.ownerFraction * 100).toFixed(1)}%)
                                  {share.settlementOwner ? (
                                    <span className="ml-2 text-xs text-amber-700">
                                      Abrechnung an: {share.settlementOwner.name}
                                    </span>
                                  ) : null}
                                </div>
                                {canManageSettlement && showSettlementReassignUi ? (
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <Select
                                      value={shareTargetById[share.id] ?? (share.settlementOwner?.id || '__ORIGINAL__')}
                                      onValueChange={(value) =>
                                        setShareTargetById((prev) => ({ ...prev, [share.id]: value }))
                                      }
                                    >
                                      <SelectTrigger className="h-8 w-[220px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__ORIGINAL__">Original behalten ({share.owner.name})</SelectItem>
                                        {transferUsers.map((user) => (
                                          <SelectItem key={user.id} value={user.id}>
                                            {user.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={Boolean(shareSavingById[share.id])}
                                      onClick={() => void handleSettlementReassign(share.id, share.ownerId)}
                                    >
                                      {shareSavingById[share.id] ? 'Speichere…' : 'Umbuchen'}
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                              <span className="ml-3 shrink-0 font-medium">{share.shareAmount.toFixed(2)} €</span>
                            </div>
                          ))
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Owner-Anteile gesamt</h3>
        <div className="rounded-md border bg-card text-card-foreground shadow-sm">
          {ownerShareTotals.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              Keine Owner-Anteile für diese Ausleihe vorhanden.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Zugeordnete Menge</TableHead>
                  <TableHead>Anteil an Ausleihe</TableHead>
                  <TableHead>Gesamtbetrag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ownerShareTotals.map((owner) => {
                  const percent =
                    rental.totalPrice > 0 ? ((owner.amount / rental.totalPrice) * 100).toFixed(1) : '0.0'
                  return (
                    <TableRow key={owner.ownerId}>
                      <TableCell className="font-medium">{owner.ownerName}</TableCell>
                      <TableCell>{owner.allocatedQuantity.toFixed(2)}</TableCell>
                      <TableCell>{percent} %</TableCell>
                      <TableCell className="font-medium">{owner.amount.toFixed(2)} €</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-2 pt-4">
        <Button variant="outline" asChild>
          <a
            href={`/api/rentals/${rental.id}/checklist`}
            target={`rental_checklist_${rental.id}`}
          >
            <FileDown className="mr-2 h-4 w-4" />
            PDF Ausleihliste
          </a>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" asChild disabled={!canEditRentalItems}>
            <Link href={`/rentals/new?edit=${rental.id}`}>Ausleihe bearbeiten</Link>
          </Button>
          <Button
            variant={canDelete ? 'destructive' : 'outline'}
            className={!canDelete ? 'opacity-60' : undefined}
            onClick={() => {
              if (!canDelete) {
                alert(deleteDeniedMessage)
                return
              }
              void handleDelete()
            }}
            disabled={isDeleting || isUpdating}
          >
            {isDeleting ? 'Löschen...' : 'Ausleihe löschen'}
          </Button>
        </div>
      </div>
    </div>
  )
}
