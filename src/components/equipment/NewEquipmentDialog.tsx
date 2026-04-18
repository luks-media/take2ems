'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { createEquipment } from '@/actions/equipment'
import { ScrollArea } from '@/components/ui/scroll-area'
import { User, Location } from '@prisma/client'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Home, Plus, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

interface OwnershipGroupInput {
  label: string
  units: number
  ownerIds: string[]
}
interface OwnerUnitShareInput {
  ownerId: string
  units: number
}

const formSchema = z.object({
  name: z.string().min(2, { message: 'Bezeichnung muss mindestens 2 Zeichen lang sein.' }),
  serialNumber: z.string().optional(),
  internalNote: z.string().optional(),
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

function NewEquipmentDialogInner({ users, locations }: { users: User[]; locations: Location[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get('new') === '1') setOpen(true)
  }, [searchParams])

  const getDefaults = useCallback((): z.infer<typeof formSchema> => {
    const quantity = 1
    return {
      name: '',
      serialNumber: '',
      internalNote: '',
      category: '',
      locationId: '',
      quantity,
      status: 'AVAILABLE',
      purchasePrice: undefined,
      dailyRate: undefined,
      ownerUnitShares:
        users.length > 0 ? [{ ownerId: users[0].id, units: quantity }] : [],
      ownershipGroups: [],
    }
  }, [users])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaults(),
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

  /** Eine exklusive Zuweisung: Stückzahl automatisch an Gesamt-Anzahl angleichen. */
  useEffect(() => {
    if (users.length === 0) return
    if (ownershipGroups.length > 0) return
    if (ownerUnitShares.length !== 1) return
    const only = ownerUnitShares[0]
    if (!only || only.units === currentQuantity) return
    form.setValue(
      'ownerUnitShares',
      [{ ownerId: only.ownerId, units: currentQuantity }],
      { shouldValidate: true }
    )
  }, [currentQuantity, users.length, ownershipGroups.length, ownerUnitShares, form])

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
    try {
      await createEquipment(values)
      setOpen(false)
      if (searchParams.get('new') === '1') {
        router.replace('/equipment')
      }
      form.reset(getDefaults())
      router.refresh()
    } catch (error) {
      console.error(error)
      alert('Equipment konnte nicht angelegt werden. Bitte Eingaben prüfen.')
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

  function updateGroup(index: number, patch: Partial<OwnershipGroupInput>) {
    const nextGroups = ownershipGroups.map((group, i) =>
      i === index ? { ...group, ...patch } : group
    )
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          form.reset(getDefaults())
        } else if (searchParams.get('new') === '1') {
          router.replace('/equipment')
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>Neues Equipment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Neues Equipment anlegen</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[80vh] px-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
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
                <FormField
                  control={form.control}
                  name="internalNote"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Dauerhafte Notiz</FormLabel>
                      <FormControl>
                        <textarea
                          className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          placeholder="Bleibt am Artikel gespeichert…"
                          maxLength={5000}
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                          onChange={(e) => updateGroup(groupIndex, { units: e.target.value ? parseInt(e.target.value, 10) : 1 })}
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
              <div className="space-y-3 pt-4">
                {users.length === 0 && (
                  <p className="text-sm text-destructive">
                    Es ist kein Benutzer angelegt – Besitzer-Zuweisung ist Pflicht.{' '}
                    <Link href="/users" className="font-medium underline underline-offset-4">
                      Benutzer anlegen
                    </Link>
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!ownersValid || users.length === 0}
                >
                  Speichern
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export function NewEquipmentDialog(props: { users: User[]; locations: Location[] }) {
  return (
    <Suspense
      fallback={
        <Button type="button" disabled className="cursor-not-allowed opacity-70">
          Neues Equipment
        </Button>
      }
    >
      <NewEquipmentDialogInner {...props} />
    </Suspense>
  )
}