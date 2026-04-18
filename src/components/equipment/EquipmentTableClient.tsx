'use client'

import { useState, useMemo } from 'react'
import type { Equipment, EquipmentInstance, User, Location } from '@prisma/client'
import { EditEquipmentDialog } from '@/components/equipment/EditEquipmentDialog'
import { EquipmentDefectsDialog } from '@/components/equipment/EquipmentDefectsDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Wrench } from 'lucide-react'
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
import { Card } from '@/components/ui/card'
import { EquipmentCategoryIcon } from '@/lib/equipment-category-icon'

type EquipmentWithOwners = Equipment & {
  owners: User[]
  instances: EquipmentInstance[]
}

type SortKey = keyof Equipment | 'owners' | 'location'
type SortOrder = 'asc' | 'desc'

export function EquipmentTableClient({ equipment, users, locations }: { equipment: EquipmentWithOwners[], users: User[], locations: Location[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [defectEquipmentId, setDefectEquipmentId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const categories = useMemo(() => {
    const cats = new Set(equipment.map(e => e.category))
    return Array.from(cats).sort()
  }, [equipment])

  const bundlePeerOptions = useMemo(
    () => equipment.map((e) => ({ id: e.id, name: e.name, equipmentCode: e.equipmentCode })),
    [equipment]
  )

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="ml-2 inline-block h-4 w-4 text-muted-foreground/50" />
    return sortOrder === 'asc' ? <ArrowUp className="ml-2 inline-block h-4 w-4" /> : <ArrowDown className="ml-2 inline-block h-4 w-4" />
  }

  const filteredAndSortedEquipment = useMemo(() => {
    const filtered = equipment.filter(item => {
      const locationName = item.locationId ? (locations.find(l => l.id === item.locationId)?.name || item.locationId) : ''
      const matchesSearch = 
        item.name.toLowerCase().includes(search.toLowerCase()) || 
        item.equipmentCode.toLowerCase().includes(search.toLowerCase()) ||
        (item.serialNumber && item.serialNumber.toLowerCase().includes(search.toLowerCase())) ||
        locationName.toLowerCase().includes(search.toLowerCase())
      
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter

      return matchesSearch && matchesCategory && matchesStatus
    })

    return filtered.sort((a, b) => {
      let aValue: any = a[sortKey as keyof Equipment]
      let bValue: any = b[sortKey as keyof Equipment]

      if (sortKey === 'owners') {
        aValue = a.owners && a.owners.length > 0 ? a.owners.map(o => o.name).join(', ') : ''
        bValue = b.owners && b.owners.length > 0 ? b.owners.map(o => o.name).join(', ') : ''
      }
      
      if (sortKey === 'location') {
        aValue = a.locationId ? (locations.find(l => l.id === a.locationId)?.name || a.locationId) : ''
        bValue = b.locationId ? (locations.find(l => l.id === b.locationId)?.name || b.locationId) : ''
      }

      if (typeof aValue === 'string') aValue = aValue.toLowerCase()
      if (typeof bValue === 'string') bValue = bValue.toLowerCase()

      if (aValue === null || aValue === undefined) aValue = ''
      if (bValue === null || bValue === undefined) bValue = ''

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [equipment, search, categoryFilter, statusFilter, sortKey, sortOrder, users, locations])

  const defectEquipment = useMemo(
    () => equipment.find((e) => e.id === defectEquipmentId) ?? null,
    [equipment, defectEquipmentId]
  )

  const statusCellLabel = (item: EquipmentWithOwners) => {
    const s = item.status
    return s === 'AVAILABLE'
      ? 'Einsatzbereit'
      : s === 'IN_USE'
        ? 'Verliehen'
        : s === 'MAINTENANCE'
          ? 'In Reparatur'
          : s === 'BROKEN'
            ? 'Defekt'
            : s
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen nach Code, Name oder S/N..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                <span className="flex items-center gap-2">
                  <EquipmentCategoryIcon category={cat} className="h-4 w-4 text-muted-foreground" />
                  {cat}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="AVAILABLE">Einsatzbereit</SelectItem>
            <SelectItem value="IN_USE">Verliehen</SelectItem>
            <SelectItem value="MAINTENANCE">In Reparatur</SelectItem>
            <SelectItem value="BROKEN">Defekt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0 shadow-sm">
        <div className="relative min-h-0 flex-1 overflow-auto">
          <Table container={false}>
          <TableHeader className="sticky top-0 z-20 border-b bg-card shadow-sm [&_th]:bg-card [&_tr]:border-b">
            <TableRow className="border-b-0 hover:bg-transparent">
              <TableHead onClick={() => handleSort('equipmentCode')} className="cursor-pointer select-none">
                Code <SortIcon columnKey="equipmentCode" />
              </TableHead>
              <TableHead onClick={() => handleSort('name')} className="cursor-pointer select-none">
                Artikelbezeichnung <SortIcon columnKey="name" />
              </TableHead>
              <TableHead onClick={() => handleSort('serialNumber')} className="cursor-pointer select-none">
                S/N <SortIcon columnKey="serialNumber" />
              </TableHead>
              <TableHead onClick={() => handleSort('category')} className="cursor-pointer select-none">
                Kategorie <SortIcon columnKey="category" />
              </TableHead>
              <TableHead onClick={() => handleSort('location')} className="cursor-pointer select-none">
                Lagerort <SortIcon columnKey="location" />
              </TableHead>
              <TableHead onClick={() => handleSort('quantity')} className="cursor-pointer select-none text-right">
                Anzahl <SortIcon columnKey="quantity" />
              </TableHead>
              <TableHead onClick={() => handleSort('dailyRate')} className="cursor-pointer select-none text-right">
                Mietpreis <SortIcon columnKey="dailyRate" />
              </TableHead>
              <TableHead className="select-none text-right">Verfügbar</TableHead>
              <TableHead onClick={() => handleSort('status')} className="cursor-pointer select-none">
                Status <SortIcon columnKey="status" />
              </TableHead>
              <TableHead onClick={() => handleSort('owners')} className="cursor-pointer select-none">
                Besitzer <SortIcon columnKey="owners" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedEquipment.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  Keine Ergebnisse.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedEquipment.map((item) => {
                const instances = item.instances ?? []
                const bookable = instances.filter((i) => i.status === 'AVAILABLE').length
                const brokenN = instances.filter((i) => i.status === 'BROKEN').length
                return (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => setEditingId(item.id)}
                >
                  <TableCell className="font-medium">{item.equipmentCode}</TableCell>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <EquipmentCategoryIcon
                        category={item.category}
                        className="mt-0.5 h-4 w-4 text-muted-foreground"
                      />
                      <div className="min-w-0">
                        <div className="font-medium">{item.name}</div>
                        {item.description && (
                          <div className="text-sm text-muted-foreground">{item.description}</div>
                        )}
                        {item.internalNote?.trim() && (
                          <div
                            className="mt-1 line-clamp-2 text-xs text-amber-800/90 dark:text-amber-400/90"
                            title={item.internalNote}
                          >
                            Notiz: {item.internalNote}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{item.serialNumber || '-'}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <EquipmentCategoryIcon category={item.category} className="h-4 w-4 text-muted-foreground" />
                      {item.category}
                    </span>
                  </TableCell>
                  <TableCell>{item.locationId ? (locations.find(l => l.id === item.locationId)?.name || '-') : '-'}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{item.dailyRate} €</TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span className="tabular-nums text-sm text-muted-foreground">
                        {instances.length === 0 ? '—' : `${bookable}/${item.quantity}`}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                        title="Defekte & Exemplare"
                        aria-label="Defekte und Exemplare verwalten"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDefectEquipmentId(item.id)
                        }}
                      >
                        <Wrench className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <span>{statusCellLabel(item)}</span>
                      {brokenN > 0 && (
                        <div className="text-xs text-destructive">
                          {brokenN} {brokenN === 1 ? 'Exemplar defekt' : 'Exemplare defekt'}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{item.owners && item.owners.length > 0 ? item.owners.map(o => o.name).join(', ') : '-'}</TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      {editingId !== null && (
        <EditEquipmentDialog
          key={editingId}
          open
          onOpenChange={(next) => {
            if (!next) setEditingId(null)
          }}
          equipmentId={editingId}
          users={users}
          locations={locations}
          bundlePeerOptions={bundlePeerOptions}
        />
      )}

      <EquipmentDefectsDialog
        equipment={defectEquipment}
        open={defectEquipmentId !== null}
        onOpenChange={(next) => {
          if (!next) setDefectEquipmentId(null)
        }}
      />
    </div>
  )
}