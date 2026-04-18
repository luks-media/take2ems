'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { User, Location } from '@prisma/client'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { ChevronDown, Home, Plus, Search, Trash2 } from 'lucide-react'
import {
  updateEquipment,
  deleteEquipment,
  updateEquipmentRentalBundle,
  getEquipmentById,
} from '@/actions/equipment'
import { Checkbox } from '@/components/ui/checkbox'

const formSchema = z.object({
  name: z.string().min(2, { message: 'Bezeichnung muss mindestens 2 Zeichen lang sein.' }),
  description: z.string().optional(),
  internalNote: z.string().optional(),
  serialNumber: z.string().optional(),
  category: z.string().min(1, { message: 'Kategorie auswählen.' }),
  locationId: z.string().optional(),
  quantity: z.number().min(1, { message: 'Mindestens 1.' }),
  status: z.string().min(1, { message: 'Zustand auswählen.' }),
  purchasePrice: z.number().min(0, { message: 'Muss positiv sein.' }).optional(),
  dailyRate: z.number().min(0, { message: 'Muss positiv sein.' }).optional(),
  ownershipGroups: z.array(
    z.object({
      label: z.string().optional(),
      units: z.number().int().min(1),
      ownerIds: z.array(z.string()).min(1),
    })).min(0),
  ownerUnitShares: z.array(
    z.object({
      ownerId: z.string(),
      units: z.number().int().min(1),
    })
  ).min(0),
})

type EquipmentWithOwners = NonNullable<Awaited<ReturnType<typeof getEquipmentById>>>

export type EquipmentBundlePeerOption = { id: string; name: string; equipmentCode: string }

export function EditEquipmentForm({
  equipment,
  users,
  locations,
  bundlePeerOptions,
  dismissOnDone,
}: {
  equipment: EquipmentWithOwners
  users: User[]
  locations: Location[]
  bundlePeerOptions: EquipmentBundlePeerOption[]
  /** Gesetzt im Dialog: nach Speichern/Löschen/Abbrechen Schließen statt zur Liste navigieren (inkl. router.refresh bei Mutation). */
  dismissOnDone?: () => void
}) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  /** Keine Vorauswahl – Stammdaten nur über „Gespeicherte Empfehlungen laden“. */
  const [bundleLinkedIds, setBundleLinkedIds] = useState<string[]>([])
  const [recommendationSectionOpen, setRecommendationSectionOpen] = useState(true)
  const [recommendationPeerSearch, setRecommendationPeerSearch] = useState('')
  const [recommendationsBundleTouched, setRecommendationsBundleTouched] = useState(false)

  useEffect(() => {
    setBundleLinkedIds([])
    setRecommendationPeerSearch('')
    setRecommendationsBundleTouched(false)
  }, [equipment.id])

  const recommendationPeerChoices = useMemo(() => {
    return bundlePeerOptions.filter((p) => p.id !== equipment.id)
  }, [bundlePeerOptions, equipment.id])

  const filteredRecommendationPeerChoices = useMemo(() => {
    const q = recommendationPeerSearch.trim().toLowerCase()
    if (!q) return recommendationPeerChoices
    return recommendationPeerChoices.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.equipmentCode.toLowerCase().includes(q)
    )
  }, [recommendationPeerChoices, recommendationPeerSearch])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: equipment.name,
      description: equipment.description || '',
      internalNote: equipment.internalNote || '',
      serialNumber: equipment.serialNumber || '',
      category: equipment.category,
      locationId: equipment.locationId || '',
      quantity: equipment.quantity,
      status: equipment.status,
      purchasePrice: equipment.purchasePrice !== null ? equipment.purchasePrice : undefined,
      dailyRate: equipment.dailyRate !== null && equipment.dailyRate !== 0 ? equipment.dailyRate : undefined,
      ownershipGroups: equipment.ownershipLots.filter((lot) => lot.shares.length > 1).map((lot) => ({
        label: lot.label || '',
        units: lot.units,
        ownerIds: lot.shares.map((share) => share.ownerId)
      })),
      ownerUnitShares: equipment.ownershipLots
        .filter((lot) => lot.shares.length === 1 && Math.abs(lot.shares[0].fraction - 1) < 0.001)
        .map((lot) => ({ ownerId: lot.shares[0].ownerId, units: lot.units })),
    },
  })

  const currentPurchasePrice = useWatch({
    control: form.control,
    name: 'purchasePrice',
  })
  const currentQuantity = useWatch({
    control: form.control,
    name: 'quantity',
  })
  const watchedOwnershipGroups = useWatch({
    control: form.control,
    name: 'ownershipGroups',
  })
  const watchedOwnerUnitShares = useWatch({
    control: form.control,
    name: 'ownerUnitShares',
  })
  const ownershipGroups = useMemo(() => watchedOwnershipGroups ?? [], [watchedOwnershipGroups])
  const ownerUnitShares = useMemo(() => watchedOwnerUnitShares ?? [], [watchedOwnerUnitShares])

  const suggestedDailyRate = currentPurchasePrice ? (currentPurchasePrice * 0.05).toFixed(2) : '0.00'
  const { ownersValid, ownersValidationText } = useMemo(() => {
    const exclusiveUnits = ownerUnitShares.reduce((sum, share) => sum + Number(share.units || 0), 0)
    const totalUnits = ownershipGroups.reduce((sum, group) => sum + Number(group.units || 0), 0)
    const allGroupsHaveOwners = ownershipGroups.every((group) => (group.ownerIds || []).length > 0)
    const hasAnyAssignment = exclusiveUnits + totalUnits > 0
    return {
      ownersValid: hasAnyAssignment && exclusiveUnits + totalUnits === currentQuantity && allGroupsHaveOwners,
      ownersValidationText: `${!hasAnyAssignment ? 'Mindestens eine Zuweisung nötig | ' : ''}Exklusiv ${exclusiveUnits} + Shared ${totalUnits} = ${exclusiveUnits + totalUnits}/${currentQuantity}${allGroupsHaveOwners ? '' : ' | Gruppe ohne Besitzer'}`,
    }
  }, [ownerUnitShares, ownershipGroups, currentQuantity])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true)
    try {
      await updateEquipment(equipment.id, values)
      if (recommendationsBundleTouched) {
        await updateEquipmentRentalBundle(equipment.id, bundleLinkedIds)
      }
      if (dismissOnDone) {
        router.refresh()
        dismissOnDone()
      } else {
        router.push('/equipment')
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Möchtest du dieses Equipment wirklich löschen?')) return
    setIsDeleting(true)
    try {
      const result = await deleteEquipment(equipment.id)
      if (result && !result.success) {
        alert(result.error || 'Fehler beim Löschen.')
        setIsDeleting(false)
        return
      }
      if (dismissOnDone) {
        router.refresh()
        dismissOnDone()
      } else {
        router.push('/equipment')
      }
    } catch (error) {
      console.error(error)
      alert('Ein Fehler ist aufgetreten.')
      setIsDeleting(false)
    }
  }

  function addGroup() {
    const nextGroups = [...ownershipGroups, { label: '', units: 1, ownerIds: [] }]
    form.setValue('ownershipGroups', nextGroups, { shouldValidate: true })
  }

  function removeGroup(index: number) {
    const nextGroups = ownershipGroups.filter((_, i) => i !== index)
    form.setValue('ownershipGroups', nextGroups, { shouldValidate: true })
  }

  function updateGroup(index: number, patch: { label?: string; units?: number; ownerIds?: string[] }) {
    const nextGroups = ownershipGroups.map((group, i) => (i === index ? { ...group, ...patch } : group))
    form.setValue('ownershipGroups', nextGroups, { shouldValidate: true })
  }

  function toggleOwnerInGroup(groupIndex: number, ownerId: string, checked: boolean) {
    const group = ownershipGroups[groupIndex]
    if (!group) return
    const ownerIds = checked
      ? Array.from(new Set([...(group.ownerIds || []), ownerId]))
      : (group.ownerIds || []).filter((id) => id !== ownerId)
    updateGroup(groupIndex, { ownerIds })
  }

  function updateGroupUnits(groupIndex: number, units: number) {
    const nextGroups = ownershipGroups.map((group, index) =>
      index === groupIndex ? { ...group, units } : group
    )
    form.setValue('ownershipGroups', nextGroups, { shouldValidate: true })
  }

  function toggleExclusiveOwner(ownerId: string, checked: boolean) {
    const existing = ownerUnitShares
    const nextShares = checked
      ? [...existing, { ownerId, units: 1 }]
      : existing.filter((share) => share.ownerId !== ownerId)
    form.setValue('ownerUnitShares', nextShares, { shouldValidate: true })
  }

  function updateExclusiveUnits(ownerId: string, units: number) {
    const nextShares = ownerUnitShares.map((share) =>
      share.ownerId === ownerId ? { ...share, units } : share
    )
    form.setValue('ownerUnitShares', nextShares, { shouldValidate: true })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Artikelbezeichnung *</FormLabel>
                <FormControl>
                  <Input placeholder="z.B. ARRI Alexa Mini" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Beschreibung</FormLabel>
                <FormControl>
                  <Input placeholder="Optionale Beschreibung" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="internalNote"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Dauerhafte Notiz</FormLabel>
                <FormControl>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Bleibt am Artikel gespeichert (z. B. Besonderheiten, Hinweise für Ausleihe)…"
                    maxLength={5000}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="serialNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Seriennummer</FormLabel>
                <FormControl>
                  <Input placeholder="S/N..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kategorie *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategorie wählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Kamera">Kamera</SelectItem>
                    <SelectItem value="Licht">Licht</SelectItem>
                    <SelectItem value="Ton">Ton</SelectItem>
                    <SelectItem value="Grip">Grip</SelectItem>
                    <SelectItem value="Production">Production</SelectItem>
                    <SelectItem value="Misc">Misc</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zustand *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Zustand wählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">Einsatzbereit</SelectItem>
                    <SelectItem value="MAINTENANCE">In Reparatur</SelectItem>
                    <SelectItem value="BROKEN">Defekt</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="locationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lagerort</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Lagerort wählen..." 
                      value={locations.find(l => l.id === field.value)?.name || ''} 
                      readOnly 
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="icon" className="shrink-0">
                          <Home className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="end">
                        <ScrollArea className="max-h-[300px]">
                          <div className="p-2 flex flex-col gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              className="justify-start font-normal h-8 px-2 text-sm text-muted-foreground"
                              onClick={() => field.onChange('')}
                            >
                              Kein Lagerort
                            </Button>
                            {locations?.map(loc => (
                              <Button
                                key={loc.id}
                                type="button"
                                variant="ghost"
                                className="justify-start font-normal h-8 px-2 text-sm"
                                onClick={() => field.onChange(loc.id)}
                              >
                                {loc.name}
                              </Button>
                            ))}
                            {(!locations || locations.length === 0) && (
                              <p className="text-sm text-muted-foreground p-2 text-center">Keine Lagerorte verfügbar.</p>
                            )}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Anzahl *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1" 
                    {...field} 
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : 1)} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="purchasePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kaufpreis (€)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    {...field} 
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dailyRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mietpreis (€)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder={`Empfohlen: ${suggestedDailyRate}`} 
                    {...field} 
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="md:col-span-2 overflow-hidden rounded-md border bg-muted/20">
            <button
              type="button"
              onClick={() => setRecommendationSectionOpen((o) => !o)}
              className="flex w-full items-start gap-2 px-4 py-3 text-left outline-none ring-offset-background transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={recommendationSectionOpen}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-base font-medium">Ausleih-Empfehlungen</div>
                {!recommendationSectionOpen && (
                  <p className="text-xs text-muted-foreground">
                    {bundleLinkedIds.length === 0
                      ? equipment.bundleLinkedIds.length > 0
                        ? `Keine ausgewählt · im Bestand ${equipment.bundleLinkedIds.length} ${equipment.bundleLinkedIds.length === 1 ? 'Partner' : 'Partner'} (optional laden) – ausklappen`
                        : 'Keine Partner ausgewählt – ausklappen zum Bearbeiten'
                      : `${bundleLinkedIds.length} ${bundleLinkedIds.length === 1 ? 'Partner' : 'Partner'} ausgewählt – ausklappen zum Bearbeiten`}
                  </p>
                )}
              </div>
              <ChevronDown
                className={cn(
                  'mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
                  recommendationSectionOpen && 'rotate-180'
                )}
                aria-hidden
              />
            </button>
            {recommendationPeerChoices.length > 0 && (
              <div className="border-t border-border/60 px-4 py-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Equipment für Empfehlungen suchen…"
                    className="h-9 bg-background pl-8 text-sm"
                    value={recommendationPeerSearch}
                    onChange={(e) => setRecommendationPeerSearch(e.target.value)}
                    aria-label="Empfehlungspartner suchen"
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {filteredRecommendationPeerChoices.length} von {recommendationPeerChoices.length}{' '}
                  {recommendationPeerChoices.length === 1 ? 'Artikel' : 'Artikeln'}
                  {recommendationPeerSearch.trim() ? ', passend zur Suche' : ''}
                  {!recommendationSectionOpen && filteredRecommendationPeerChoices.length > 0
                    ? ' · Liste ausklappen zum Anhaken'
                    : ''}
                </p>
              </div>
            )}
            <div
              className={cn(
                'grid border-t border-border/60 transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
                recommendationSectionOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr] pointer-events-none'
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="space-y-3 p-4 pt-3">
                  <p className="text-xs text-muted-foreground">
                    Nur angehakte Artikel sind Empfehlungspartner. Standardmäßig ist nichts ausgewählt; gespeicherte
                    Verknüpfungen kannst du unten laden. Gewählte erscheinen bei neuer Ausleihe unter „passend dazu“ –
                    nicht automatisch im Warenkorb.
                  </p>
                  {equipment.bundleLinkedIds.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setBundleLinkedIds([...equipment.bundleLinkedIds])
                        setRecommendationsBundleTouched(true)
                      }}
                    >
                      Gespeicherte Empfehlungen aus Stammdaten laden ({equipment.bundleLinkedIds.length})
                    </Button>
                  )}
                  {recommendationPeerChoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Kein weiteres Equipment vorhanden.</p>
                  ) : (
                    <>
                      {filteredRecommendationPeerChoices.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Keine Treffer für „{recommendationPeerSearch.trim()}“.
                        </p>
                      ) : (
                        <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
                          {filteredRecommendationPeerChoices.map((p) => (
                            <label
                              key={p.id}
                              className="flex cursor-pointer items-center gap-2 rounded border bg-background px-2 py-1.5 text-sm"
                            >
                              <Checkbox
                                checked={bundleLinkedIds.includes(p.id)}
                                onCheckedChange={(checked) => {
                                  setRecommendationsBundleTouched(true)
                                  setBundleLinkedIds((prev) =>
                                    checked
                                      ? prev.includes(p.id)
                                        ? prev
                                        : [...prev, p.id]
                                      : prev.filter((id) => id !== p.id)
                                  )
                                }}
                              />
                              <span className="min-w-0 truncate">
                                <span className="font-mono text-xs text-muted-foreground">{p.equipmentCode}</span>{' '}
                                {p.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-3 rounded-md border p-4 bg-muted/20">
            <div className="text-base font-medium">Besitzverhältnis</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {users.map((user) => {
                const share = ownerUnitShares.find((s) => s.ownerId === user.id)
                return (
                  <div key={user.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={Boolean(share)}
                      onCheckedChange={(checked) => toggleExclusiveOwner(user.id, Boolean(checked))}
                    />
                    <span className="text-sm flex-1">{user.name}</span>
                    <Input
                      type="number"
                      min="1"
                      className="w-20"
                      disabled={!share}
                      value={share?.units ?? ''}
                      onChange={(e) => updateExclusiveUnits(user.id, e.target.value ? parseInt(e.target.value, 10) : 1)}
                    />
                    <span className="text-xs text-muted-foreground">Stk</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="md:col-span-2 space-y-3 rounded-md border p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="text-base font-medium">Shared-Gruppen</div>
              <Button type="button" variant="outline" size="sm" onClick={addGroup}>
                <Plus className="h-4 w-4 mr-1" />
                Gruppe hinzufügen
              </Button>
            </div>
            {ownershipGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="rounded-md border bg-background p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Gruppenname (optional)"
                    value={group.label || ''}
                    onChange={(e) => updateGroup(groupIndex, { label: e.target.value })}
                  />
                  <Input
                    type="number"
                    min="1"
                    className="w-24"
                    value={group.units}
                    onChange={(e) => updateGroupUnits(groupIndex, e.target.value ? parseInt(e.target.value, 10) : 1)}
                  />
                  <span className="text-xs text-muted-foreground">Stk</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeGroup(groupIndex)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {users.map((user) => {
                    const checked = (group.ownerIds || []).includes(user.id)
                    return (
                      <div key={user.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(isChecked) => toggleOwnerInGroup(groupIndex, user.id, Boolean(isChecked))}
                        />
                        <span className="text-sm">{user.name}</span>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Gleichanteilig: {(group.ownerIds || []).length > 0 ? `${(100 / (group.ownerIds || []).length).toFixed(1)}% pro Owner` : 'Noch keine Owner'}
                </p>
              </div>
            ))}
            <div className={`text-xs ${ownersValid ? 'text-muted-foreground' : 'text-destructive'}`}>
              {ownersValidationText}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button 
            type="button" 
            variant="destructive" 
            onClick={handleDelete}
            disabled={isDeleting || isSaving}
          >
            {isDeleting ? 'Löschen...' : 'Löschen'}
          </Button>
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => (dismissOnDone ? dismissOnDone() : router.push('/equipment'))}
              disabled={isDeleting || isSaving}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isDeleting || isSaving || !ownersValid}>
              {isSaving ? 'Speichern...' : 'Speichern'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}