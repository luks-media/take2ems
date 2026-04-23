'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createLocation, deleteLocation } from '@/actions/location'
import { Trash2, MapPin } from 'lucide-react'

type UserWithLocations = {
  id: string
  name: string
  locations: Array<{
    id: string
    name: string
  }>
}

export function UserLocationsDialog({ user }: { user: UserWithLocations }) {
  const [open, setOpen] = useState(false)
  const [newLocName, setNewLocName] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async () => {
    if (!newLocName.trim()) return
    setIsAdding(true)
    await createLocation({ name: newLocName.trim(), userId: user.id })
    setNewLocName('')
    setIsAdding(false)
  }

  const handleDelete = async (locId: string) => {
    if (!confirm('Möchtest du diesen Lagerort wirklich löschen?')) return
    await deleteLocation(locId)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Lagerorte ({user.locations?.length || 0})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Lagerorte für {user.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2">
            <Input 
              placeholder="Neuer Lagerort Name..." 
              value={newLocName} 
              onChange={e => setNewLocName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            />
            <Button onClick={handleAdd} disabled={isAdding || !newLocName.trim()}>Hinzufügen</Button>
          </div>
          
          {user.locations && user.locations.length > 0 ? (
            <ul className="space-y-2 mt-4">
              {user.locations.map(loc => (
                <li key={loc.id} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                  <span>{loc.name}</span>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(loc.id)} className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Keine Lagerorte für diesen Nutzer vorhanden.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
