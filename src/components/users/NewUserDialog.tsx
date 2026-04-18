'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createUser } from '@/actions/user'

export function NewUserDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [role, setRole] = useState('USER')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    
    const formData = new FormData(event.currentTarget)
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      await createUser({ name, email, password, role })
      setOpen(false)
      router.refresh()
    } catch (error: any) {
      console.error(error)
      setError(error?.message || 'Fehler beim Erstellen des Benutzers.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Neuen Benutzer anlegen</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Neuer Benutzer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="Max Mustermann" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" name="email" type="email" required placeholder="max@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Rolle</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Speichern...' : 'Speichern'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
