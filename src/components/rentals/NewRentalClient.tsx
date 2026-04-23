'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Equipment } from '@prisma/client'
import { format, differenceInDays } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Search,
  Trash2,
  ShoppingCart,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { createRental } from '@/actions/rental'
import { searchCustomers, type CustomerSearchHit } from '@/actions/customer'
import { EquipmentCategoryIcon } from '@/lib/equipment-category-icon'

export type NewRentalAppPrefs = {
  defaultRentalStatus: 'PENDING' | 'ACTIVE'
  discountAllowed: boolean
  minRentalDays: number
}

export type BorrowerChoice = { id: string; name: string; email: string }

interface Props {
  equipment: Equipment[]
  nextRentalsMap: Record<string, string> // equipmentId -> ISO date string
  totalRentableMap: Record<string, number> // equipmentId -> number of rentable instances
  activeBlocks: { equipmentId: string; startDate: string; endDate: string; quantity: number }[]
  borrowerChoices: BorrowerChoice[]
  defaultBorrowerId: string | null
  canSelectBorrower: boolean
  appPrefs: NewRentalAppPrefs
}

interface CartItem {
  equipment: Equipment
  quantity: number
  /** Freitext pro Position */
  note: string
}

type DiscountType = 'percent' | 'fixed'

const BORROWER_NONE = '__none__'

export default function NewRentalClient({
  equipment,
  nextRentalsMap,
  totalRentableMap,
  activeBlocks,
  borrowerChoices,
  defaultBorrowerId,
  canSelectBorrower,
  appPrefs,
}: Props) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  
  // Date states
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: undefined,
    to: undefined
  })
  
  const [customerName, setCustomerName] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSearchHit[]>([])
  const [customerSuggestOpen, setCustomerSuggestOpen] = useState(false)
  const [borrowerUserId, setBorrowerUserId] = useState<string>(
    defaultBorrowerId || BORROWER_NONE
  )
  const [discountType, setDiscountType] = useState<DiscountType>('percent')
  const [discountInput, setDiscountInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  /** Passend-dazu-Panel: Suchfeld nutzbar → standardmäßig aufgeklappt. */
  const [recommendationsPanelOpen, setRecommendationsPanelOpen] = useState(true)
  const [recommendationListSearch, setRecommendationListSearch] = useState('')

  const hasSelectedRange = Boolean(dateRange.from && dateRange.to)

  const availableQuantityMap = useMemo(() => {
    const map: Record<string, number> = {}

    for (const item of equipment) {
      const totalRentable = totalRentableMap[item.id] || 0

      if (!hasSelectedRange || !dateRange.from || !dateRange.to) {
        map[item.id] = totalRentable
        continue
      }

      let blocked = 0
      for (const block of activeBlocks) {
        if (block.equipmentId !== item.id) continue

        const blockStart = new Date(block.startDate)
        const blockEnd = new Date(block.endDate)
        const overlaps = blockStart <= dateRange.to && blockEnd >= dateRange.from

        if (overlaps) blocked += block.quantity
      }

      map[item.id] = Math.max(totalRentable - blocked, 0)
    }

    return map
  }, [equipment, totalRentableMap, activeBlocks, dateRange.from, dateRange.to, hasSelectedRange])

  // Filter equipment by search; unavailable gear stays visible (gray) for clarity.
  const categories = useMemo(
    () => Array.from(new Set(equipment.map((item) => item.category))).sort(),
    [equipment]
  )

  const cartQuantityById = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of cart) m[c.equipment.id] = c.quantity
    return m
  }, [cart])

  const equipmentById = useMemo(() => {
    const m = new Map<string, Equipment>()
    for (const e of equipment) m.set(e.id, e)
    return m
  }, [equipment])

  /** Gleiche `rentalBundleId` = Empfehlungsgruppe (mindestens zwei Artikel). */
  const recommendationPeersByEquipmentId = useMemo(() => {
    const byBundle = new Map<string, string[]>()
    for (const e of equipment) {
      if (!e.rentalBundleId) continue
      const arr = byBundle.get(e.rentalBundleId) ?? []
      arr.push(e.id)
      byBundle.set(e.rentalBundleId, arr)
    }
    const out: Record<string, string[]> = {}
    for (const e of equipment) {
      if (!e.rentalBundleId) continue
      const peers = byBundle.get(e.rentalBundleId) ?? []
      const sorted = [...peers].sort()
      if (sorted.length >= 2) {
        out[e.id] = sorted
      }
    }
    return out
  }, [equipment])

  const getRecommendationPeerIds = (equipmentId: string): string[] | null => {
    const peers = recommendationPeersByEquipmentId[equipmentId]
    return peers && peers.length > 1 ? peers : null
  }

  /** Aus Warenkorb-Zeilen abgeleitete Empfehlungen, die noch nicht im Warenkorb sind. */
  const cartRecommendationHints = useMemo(() => {
    const inCartIds = new Set(cart.map((c) => c.equipment.id))
    const byPeerId = new Map<string, { equipment: Equipment; suggestedBecauseOf: Set<string> }>()

    for (const line of cart) {
      const peers = recommendationPeersByEquipmentId[line.equipment.id]
      if (!peers || peers.length < 2) continue
      for (const pid of peers) {
        if (pid === line.equipment.id || inCartIds.has(pid)) continue
        const eq = equipmentById.get(pid)
        if (!eq) continue
        let entry = byPeerId.get(pid)
        if (!entry) {
          entry = { equipment: eq, suggestedBecauseOf: new Set<string>() }
          byPeerId.set(pid, entry)
        }
        entry.suggestedBecauseOf.add(line.equipment.name)
      }
    }

    return Array.from(byPeerId.values()).sort((a, b) =>
      a.equipment.equipmentCode.localeCompare(b.equipment.equipmentCode)
    )
  }, [cart, equipmentById, recommendationPeersByEquipmentId])

  const filteredCartRecommendationHints = useMemo(() => {
    const q = recommendationListSearch.trim().toLowerCase()
    if (!q) return cartRecommendationHints
    return cartRecommendationHints.filter(({ equipment: rec, suggestedBecauseOf }) => {
      const because = Array.from(suggestedBecauseOf).join(' ').toLowerCase()
      return (
        rec.name.toLowerCase().includes(q) ||
        rec.equipmentCode.toLowerCase().includes(q) ||
        rec.category.toLowerCase().includes(q) ||
        because.includes(q)
      )
    })
  }, [cartRecommendationHints, recommendationListSearch])

  useEffect(() => {
    if (cartRecommendationHints.length === 0) {
      setRecommendationListSearch('')
      setRecommendationsPanelOpen(false)
    }
  }, [cartRecommendationHints.length])

  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      const availableQty = availableQuantityMap[item.id] || 0
      const inCart = cartQuantityById[item.id] || 0
      // Liste: Zeile erst ausblenden, wenn alle verfügbaren Stück im Warenkorb liegen
      if (availableQty > 0 && inCart >= availableQty) return false

      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.equipmentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.category.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
      const remaining = Math.max(0, availableQty - inCart)
      const matchesAvailability =
        availabilityFilter === 'all' ||
        (availabilityFilter === 'available' && remaining > 0) ||
        (availabilityFilter === 'unavailable' && availableQty === 0)

      return matchesSearch && matchesCategory && matchesAvailability
    })
  }, [equipment, searchTerm, categoryFilter, availabilityFilter, availableQuantityMap, cartQuantityById])

  useEffect(() => {
    setCart((prev) =>
      prev
        .map((item) => {
          const maxAvailable = availableQuantityMap[item.equipment.id] || 0
          if (maxAvailable <= 0) return null
          if (item.quantity > maxAvailable) {
            return { ...item, quantity: maxAvailable }
          }
          return item
        })
        .filter((item): item is CartItem => item !== null)
    )
  }, [availableQuantityMap])

  useEffect(() => {
    const refreshAvailability = () => {
      router.refresh()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAvailability()
      }
    }

    window.addEventListener('focus', refreshAvailability)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', refreshAvailability)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [router])

  useEffect(() => {
    const q = customerName.trim()
    if (q.length < 1) {
      setCustomerSuggestions([])
      return
    }
    const t = window.setTimeout(() => {
      void searchCustomers(q).then(setCustomerSuggestions).catch(() => setCustomerSuggestions([]))
    }, 200)
    return () => window.clearTimeout(t)
  }, [customerName])

  const handleCustomerInputChange = (value: string) => {
    setCustomerName(value)
    setSelectedCustomerId(null)
  }

  const pickCustomerSuggestion = (hit: CustomerSearchHit) => {
    setCustomerName(hit.name)
    setSelectedCustomerId(hit.id)
    setCustomerSuggestions([])
    setCustomerSuggestOpen(false)
  }

  const handleAddToCart = (item: Equipment) => {
    if (!hasSelectedRange) return
    const availableQty = availableQuantityMap[item.id] || 0
    if (availableQty <= 0) return
    setCart((prev) => {
      const existing = prev.find((c) => c.equipment.id === item.id)
      if (existing) {
        if (existing.quantity >= availableQty) return prev
        return prev.map((c) =>
          c.equipment.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      }
      return [...prev, { equipment: item, quantity: 1, note: '' }]
    })
  }

  const handleUpdateQuantity = (id: string, delta: number) => {
    const availableQty = availableQuantityMap[id] || 0
    setCart((prev) =>
      prev.map((item) => {
        if (item.equipment.id === id) {
          const newQuantity = Math.max(1, Math.min(availableQty, item.quantity + delta))
          return { ...item, quantity: newQuantity }
        }
        return item
      })
    )
  }

  const handleRemoveFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.equipment.id !== id))
  }

  // Calculations
  const totalDays = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return 0
    const diff = differenceInDays(dateRange.to, dateRange.from)
    return Math.max(diff, 1)
  }, [dateRange])

  /** Ausklappbar; einklappen sobald Zeitraum gültig ist (inkl. Mindesttage), damit Liste/Warenkorb mehr Platz haben. */
  const [detailsExpanded, setDetailsExpanded] = useState(true)
  const detailsComplete = hasSelectedRange && totalDays >= appPrefs.minRentalDays

  useEffect(() => {
    if (detailsComplete) {
      setDetailsExpanded(false)
    } else {
      setDetailsExpanded(true)
    }
  }, [detailsComplete])

  const borrowerSummaryLabel =
    borrowerUserId === BORROWER_NONE
      ? 'Kein Bearbeiter'
      : borrowerChoices.find((u) => u.id === borrowerUserId)?.name ?? 'Bearbeiter'

  const fixedBorrower =
    borrowerChoices.find((u) => u.id === defaultBorrowerId) || borrowerChoices[0] || null

  const detailsSummaryLine = !hasSelectedRange
    ? 'Zeitraum wählen, um Verfügbarkeiten zu sehen …'
    : totalDays < appPrefs.minRentalDays
      ? `${format(dateRange.from!, 'dd.MM.yyyy', { locale: de })} – ${format(dateRange.to!, 'dd.MM.yyyy', { locale: de })} · ${totalDays} Tage (mind. ${appPrefs.minRentalDays} erforderlich)`
      : `${format(dateRange.from!, 'dd.MM.yyyy', { locale: de })} – ${format(dateRange.to!, 'dd.MM.yyyy', { locale: de })} · ${borrowerSummaryLabel}${
          customerName.trim() ? ` · ${customerName.trim()}` : ''
        }`

  const totalDailyRate = useMemo(() => {
    return cart.reduce((sum, item) => sum + ((item.equipment.dailyRate || 0) * item.quantity), 0)
  }, [cart])

  const baseTotalPrice = totalDailyRate * totalDays
  const parsedDiscountInput = Number.parseFloat(discountInput.replace(',', '.'))
  const rawDiscountValue = Number.isFinite(parsedDiscountInput) ? parsedDiscountInput : 0
  const sanitizedDiscountValue = Math.max(rawDiscountValue, 0)
  const calculatedDiscountAmount =
    discountType === 'percent'
      ? (baseTotalPrice * sanitizedDiscountValue) / 100
      : sanitizedDiscountValue
  const discountAmount = appPrefs.discountAllowed
    ? Math.min(calculatedDiscountAmount, baseTotalPrice)
    : 0
  const totalPrice = Math.max(baseTotalPrice - discountAmount, 0)

  const cartPriceBreakdown = useMemo(() => {
    const entries = cart.map((item) => ({
      equipmentId: item.equipment.id,
      quantity: item.quantity,
      dailyRate: item.equipment.dailyRate || 0,
      baseItemTotal: (item.equipment.dailyRate || 0) * item.quantity * totalDays,
    }))

    if (entries.length === 0) {
      return []
    }

    if (baseTotalPrice <= 0 || discountAmount <= 0) {
      return entries.map((entry) => ({
        ...entry,
        discountedItemTotal: Number(entry.baseItemTotal.toFixed(2)),
      }))
    }

    const discountFactor = totalPrice / baseTotalPrice
    let remaining = Number(totalPrice.toFixed(2))

    return entries.map((entry, index) => {
      if (index === entries.length - 1) {
        return {
          ...entry,
          discountedItemTotal: Number(remaining.toFixed(2)),
        }
      }

      const discounted = Number((entry.baseItemTotal * discountFactor).toFixed(2))
      remaining = Number((remaining - discounted).toFixed(2))
      return {
        ...entry,
        discountedItemTotal: discounted,
      }
    })
  }, [cart, totalDays, baseTotalPrice, discountAmount, totalPrice])

  const saveDisabledBase =
    cart.length === 0 || !dateRange.from || !dateRange.to || isSubmitting || totalDays < appPrefs.minRentalDays

  const handleSaveWithStatus = async (rentalStatus: 'PENDING' | 'ACTIVE' | 'DRAFT') => {
    if (!dateRange.from || !dateRange.to || cart.length === 0) return
    setErrorMessage(null)
    if (totalDays < appPrefs.minRentalDays) {
      setErrorMessage(`Mindest-Mietdauer: ${appPrefs.minRentalDays} ${appPrefs.minRentalDays === 1 ? 'Tag' : 'Tage'}.`)
      return
    }
    setIsSubmitting(true)
    try {
      await createRental({
        customerId: selectedCustomerId ?? undefined,
        customerName: customerName || undefined,
        borrowerUserId: canSelectBorrower
          ? borrowerUserId === BORROWER_NONE
            ? null
            : borrowerUserId
          : defaultBorrowerId,
        startDate: dateRange.from,
        endDate: dateRange.to,
        totalDays,
        totalPrice,
        status: rentalStatus,
        items: cartPriceBreakdown.map((row) => {
          const cartLine = cart.find((c) => c.equipment.id === row.equipmentId)
          const rawNote = cartLine?.note?.trim() ?? ''
          return {
            equipmentId: row.equipmentId,
            quantity: row.quantity,
            dailyRate: row.dailyRate,
            totalPrice: row.discountedItemTotal,
            note: rawNote.length > 0 ? rawNote.slice(0, 2000) : undefined,
          }
        }),
      })
      
      router.push('/rentals')
      router.refresh()
    } catch (error: any) {
      console.error("Failed to create rental", error)
      setErrorMessage(error.message || "Ein Fehler ist aufgetreten. Möglicherweise sind nicht mehr genug Artikel verfügbar.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const cartTotalItems = cart.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b bg-muted/20 px-4 py-3">
        <button
          type="button"
          onClick={() => setDetailsExpanded((open) => !open)}
          className="flex w-full items-start gap-3 rounded-lg px-1 py-1 text-left outline-none ring-offset-background transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={detailsExpanded}
          aria-controls="new-rental-details-panel"
        >
          <div className="min-w-0 flex-1 space-y-0.5">
            <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Details</h4>
            {!detailsExpanded && (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">{detailsSummaryLine}</p>
            )}
          </div>
          <ChevronDown
            className={cn(
              'mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
              detailsExpanded && 'rotate-180'
            )}
            aria-hidden
          />
        </button>

        <div
          id="new-rental-details-panel"
          role="region"
          aria-hidden={!detailsExpanded}
          className={cn(
            'grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
            detailsExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr] pointer-events-none'
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="grid gap-4 pb-1 pt-3 md:grid-cols-2">
          <div className="grid gap-2 md:col-span-2">
            <Label>Zeitraum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={cn(
                    'w-full justify-start bg-background text-left font-normal',
                    !dateRange.from && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'PP', { locale: de })} - {format(dateRange.to, 'PP', { locale: de })}
                      </>
                    ) : (
                      format(dateRange.from, 'PP', { locale: de })
                    )
                  ) : (
                    <span>Zeitraum wählen</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    setDateRange({
                      from: range?.from,
                      to: range?.to,
                    })
                  }}
                  numberOfMonths={2}
                  locale={de}
                />
              </PopoverContent>
            </Popover>
            {!hasSelectedRange && (
              <p className="text-xs text-muted-foreground">
                Wähle zuerst den Zeitraum, damit die Liste die korrekten Verfügbarkeiten anzeigt.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Mindest-Mietdauer laut Einstellungen: {appPrefs.minRentalDays}{' '}
              {appPrefs.minRentalDays === 1 ? 'Tag' : 'Tage'}.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="borrower-user">Bearbeiter (Nutzer)</Label>
            {canSelectBorrower ? (
              <>
                <Select value={borrowerUserId} onValueChange={setBorrowerUserId}>
                  <SelectTrigger id="borrower-user" className="bg-background">
                    <SelectValue placeholder="Nutzer wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={BORROWER_NONE}>Kein Bearbeiter</SelectItem>
                    {borrowerChoices.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Steuert Eigentümer-Anteile und den virtuellen Kontostand. Ohne Auswahl keine interne Zuordnung (Kunde /
                  Projekt reicht dann nur als Freitext).
                </p>
              </>
            ) : (
              <>
                <div
                  id="borrower-user"
                  className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-foreground"
                >
                  {fixedBorrower ? `${fixedBorrower.name} (${fixedBorrower.email})` : 'Eigener Account'}
                </div>
              </>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="customer">Kunde / Projekt (optional)</Label>
            <div className="relative">
              <Input
                id="customer"
                placeholder="z.B. Mustermann GmbH"
                autoComplete="off"
                value={customerName}
                onChange={(e) => {
                  handleCustomerInputChange(e.target.value)
                  setCustomerSuggestOpen(true)
                }}
                onFocus={() => setCustomerSuggestOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setCustomerSuggestOpen(false), 180)
                }}
              />
              {customerSuggestOpen && customerSuggestions.length > 0 && (
                <ul
                  className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
                  role="listbox"
                >
                  {customerSuggestions.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickCustomerSuggestion(hit)}
                      >
                        {hit.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Vorschläge aus der Kundendatenbank. Beim Speichern wird die Ausleihe mit dem Kunden verknüpft (Auswahl
              oder gleicher Name); neue Namen legen einen Kunden an.
            </p>
          </div>

          {appPrefs.discountAllowed && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:col-span-2">
              <div className="grid gap-2">
                <Label>Rabattart</Label>
                <Select value={discountType} onValueChange={(value: DiscountType) => setDiscountType(value)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Prozent (%)</SelectItem>
                    <SelectItem value="fixed">Festbetrag (EUR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="discount-input">Rabatt</Label>
                <Input
                  id="discount-input"
                  type="number"
                  min="0"
                  step={discountType === 'percent' ? '0.1' : '0.01'}
                  placeholder={discountType === 'percent' ? 'z.B. 10' : 'z.B. 25.00'}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Left Pane: Available Equipment */}
      <div className="flex h-full min-h-0 w-full flex-col border-r bg-muted/20 lg:w-1/2">
        <div className="p-4 border-b">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Equipment suchen..."
                className="pl-8 bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Kategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kategorien</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      <span className="flex items-center gap-2">
                        <EquipmentCategoryIcon category={category} className="h-4 w-4 text-muted-foreground" />
                        {category}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={availabilityFilter}
                onValueChange={(value: 'all' | 'available' | 'unavailable') => setAvailabilityFilter(value)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Verfügbarkeit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="available">Verfügbar</SelectItem>
                  <SelectItem value="unavailable">Nicht verfügbar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="grid gap-3">
            {filteredEquipment.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Kein Equipment gefunden.</p>
            ) : (
              filteredEquipment.map((item) => (
                (() => {
                  const peerIds = getRecommendationPeerIds(item.id)
                  const peerNamesHint =
                    peerIds
                      ?.filter((pid) => pid !== item.id)
                      .map((pid) => equipmentById.get(pid)?.name)
                      .filter((n): n is string => Boolean(n?.trim()))
                      .join(' · ') ?? ''
                  const availableQty = availableQuantityMap[item.id] || 0
                  const inCart = cartQuantityById[item.id] || 0
                  const remaining = Math.max(0, availableQty - inCart)
                  const isUnavailable = hasSelectedRange && availableQty === 0
                  const isDisabled = !hasSelectedRange || isUnavailable || remaining === 0

                  return (
                <div 
                  key={item.id} 
                  className={cn(
                    "flex items-center justify-between rounded-lg border bg-card p-3 shadow-sm transition-colors",
                    isDisabled
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:border-primary cursor-pointer"
                  )}
                  onClick={() => {
                    if (!isDisabled) {
                      handleAddToCart(item)
                    }
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2 pr-2">
                    <EquipmentCategoryIcon
                      category={item.category}
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 font-semibold">
                        {peerIds && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded border border-dashed border-amber-500/40 bg-amber-500/5 px-1 py-0 text-[10px] font-medium uppercase tracking-wide text-amber-900/80 dark:text-amber-200/90"
                            title="Ausleih-Empfehlung: oft passend dazu, freiwillig buchbar"
                          >
                            <Sparkles className="h-3 w-3" aria-hidden />
                            Empfehlung
                          </span>
                        )}
                        <span>{item.name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">{item.equipmentCode} • {item.category}</div>
                      {peerNamesHint ? (
                        <p
                          className="mt-0.5 line-clamp-2 text-xs text-muted-foreground"
                          title={`Oft dazu: ${peerNamesHint}`}
                        >
                          Oft dazu: {peerNamesHint}
                        </p>
                      ) : null}
                      {item.internalNote?.trim() && (
                        <div
                          className="mt-1 line-clamp-2 text-xs text-amber-800/90 dark:text-amber-400/85"
                          title={item.internalNote}
                        >
                          {item.internalNote}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{item.dailyRate} € / Tag</div>
                    <div className={cn("text-xs", isUnavailable ? "text-destructive" : "text-muted-foreground")}>
                      {!hasSelectedRange
                        ? 'Datum wählen'
                        : inCart > 0
                          ? `Noch verfügbar: ${remaining}`
                          : `Verfügbar: ${availableQty}`}
                    </div>
                  </div>
                </div>
                  )
                })()
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Pane: Cart */}
      <div className="flex h-full min-h-0 w-full flex-col bg-background lg:w-1/2">
        <div className="flex shrink-0 items-center gap-2 border-b p-4">
          <ShoppingCart className="h-5 w-5" />
          <h3 className="font-semibold">Warenkorb</h3>
          <span className="ml-auto rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground">{cartTotalItems}</span>
        </div>

        <ScrollArea className="min-h-0 flex-1 p-4">
          <div className="space-y-4">
            <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Gewähltes Equipment</h4>

            {errorMessage && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{errorMessage}</div>
            )}

            <div className="grid gap-2">
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Warenkorb ist leer.</p>
                ) : (
                  <>
                  {cart.map((item) => (
                    <div key={item.equipment.id} className="flex flex-col gap-2 rounded-md border p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex min-w-0 flex-1 items-start gap-2 pr-4">
                          <EquipmentCategoryIcon
                            category={item.equipment.category}
                            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{item.equipment.name}</div>
                            <div className="text-xs text-muted-foreground">{item.equipment.dailyRate} €/Tag pro Stück</div>
                            {item.equipment.internalNote?.trim() && (
                              <div
                                className="mt-1 line-clamp-2 text-xs text-amber-800/90 dark:text-amber-400/85"
                                title={item.equipment.internalNote}
                              >
                                {item.equipment.internalNote}
                              </div>
                            )}
                            {nextRentalsMap[item.equipment.id] && (
                              <div className="mt-1 text-xs font-medium text-orange-500">
                                Nächste Ausleihe: {format(new Date(nextRentalsMap[item.equipment.id]), 'dd.MM.yyyy')}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive -mt-1 -mr-1" onClick={() => handleRemoveFromCart(item.equipment.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-2 border rounded-md p-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={() => handleUpdateQuantity(item.equipment.id, -1)}
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm w-4 text-center font-medium">{item.quantity}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={() => handleUpdateQuantity(item.equipment.id, 1)}
                            disabled={item.quantity >= (availableQuantityMap[item.equipment.id] || 0)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-sm font-medium">
                          {((item.equipment.dailyRate || 0) * item.quantity).toFixed(2)} € / Tag
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Notiz zu dieser Position</Label>
                        <textarea
                          className={cn(
                            'flex min-h-[56px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm',
                            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                          )}
                          placeholder="Optional, z. B. Zubehör, Zustand, Hinweise…"
                          maxLength={2000}
                          rows={2}
                          value={item.note}
                          onChange={(e) =>
                            setCart((prev) =>
                              prev.map((c) =>
                                c.equipment.id === item.equipment.id
                                  ? { ...c, note: e.target.value }
                                  : c
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                  {cartRecommendationHints.length > 0 && (
                    <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/25">
                      <button
                        type="button"
                        onClick={() => setRecommendationsPanelOpen((o) => !o)}
                        className="flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left outline-none ring-offset-background transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                        aria-expanded={recommendationsPanelOpen}
                      >
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Passend dazu (nur Vorschläge)
                          </div>
                          {!recommendationsPanelOpen && (
                            <p className="text-xs text-muted-foreground">
                              {cartRecommendationHints.length}{' '}
                              {cartRecommendationHints.length === 1 ? 'Vorschlag' : 'Vorschläge'} – Suche nutzen oder
                              Liste ausklappen
                            </p>
                          )}
                        </div>
                        <ChevronDown
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                            recommendationsPanelOpen && 'rotate-180'
                          )}
                          aria-hidden
                        />
                      </button>
                      <div className="border-t border-dashed border-muted-foreground/20 px-3 py-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="search"
                            placeholder="Vorschläge durchsuchen…"
                            className="h-9 bg-background pl-8 text-sm"
                            value={recommendationListSearch}
                            onChange={(e) => setRecommendationListSearch(e.target.value)}
                            aria-label="Empfehlungen durchsuchen"
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {filteredCartRecommendationHints.length} von {cartRecommendationHints.length}{' '}
                          {cartRecommendationHints.length === 1 ? 'Vorschlag' : 'Vorschlägen'}
                          {recommendationListSearch.trim() ? ', passend zur Suche' : ''}
                          {!recommendationsPanelOpen && filteredCartRecommendationHints.length > 0
                            ? ' · Liste ausklappen zum Hinzufügen'
                            : ''}
                        </p>
                      </div>
                      <div
                        className={cn(
                          'grid overflow-hidden border-t border-dashed border-muted-foreground/20 transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
                          recommendationsPanelOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr] pointer-events-none'
                        )}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div className="space-y-2 p-3 pt-2">
                            {filteredCartRecommendationHints.length === 0 ? (
                              <p className="py-2 text-center text-xs text-muted-foreground">
                                {recommendationListSearch.trim()
                                  ? `Keine Treffer für „${recommendationListSearch.trim()}“.`
                                  : 'Keine Vorschläge.'}
                              </p>
                            ) : (
                              <ul className="max-h-56 space-y-2 overflow-y-auto pr-0.5">
                                {filteredCartRecommendationHints.map(({ equipment: rec, suggestedBecauseOf }) => {
                                  const avail = availableQuantityMap[rec.id] || 0
                                  const inC = cartQuantityById[rec.id] || 0
                                  const remaining = Math.max(0, avail - inC)
                                  const canAdd = hasSelectedRange && avail > 0 && remaining > 0
                                  const because = Array.from(suggestedBecauseOf).join(', ')
                                  return (
                                    <li
                                      key={rec.id}
                                      className="flex flex-col gap-2 rounded-md border bg-background/80 p-2 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <div className="min-w-0">
                                        <div className="text-sm font-medium">{rec.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {rec.equipmentCode}
                                          {because ? ` · wegen: ${because}` : ''}
                                        </div>
                                      </div>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        className="shrink-0"
                                        disabled={!canAdd}
                                        onClick={() => handleAddToCart(rec)}
                                      >
                                        Hinzufügen
                                      </Button>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  </>
                )}
              </div>
          </div>
        </ScrollArea>

        <div className="mt-auto shrink-0 border-t bg-muted/10 p-4">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tage</span>
              <span>{totalDays} {totalDays === 1 ? 'Tag' : 'Tage'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Zwischensumme</span>
              <span>{baseTotalPrice.toFixed(2)} €</span>
            </div>
            {appPrefs.discountAllowed && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rabatt</span>
                <span>-{discountAmount.toFixed(2)} €</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <span>Gesamtpreis</span>
              <span>{totalPrice.toFixed(2)} €</span>
            </div>
          </div>
          
          <Button
            className="w-full"
            size="lg"
            onClick={() => handleSaveWithStatus(appPrefs.defaultRentalStatus)}
            disabled={saveDisabledBase}
          >
            {isSubmitting ? 'Wird gespeichert…' : 'Ausleihe speichern'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => handleSaveWithStatus('DRAFT')}
            disabled={saveDisabledBase}
          >
            Als Entwurf speichern
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Entwürfe reservieren <strong>keinen</strong> Bestand. Beim späteren Wechsel zu „Ausstehend“ werden
            Exemplare zugewiesen.
          </p>
        </div>
      </div>
      </div>
    </div>
  )
}
