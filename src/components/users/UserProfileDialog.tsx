'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { deleteUser, updateUser } from '@/actions/user'
import { Pencil, Trash2 } from 'lucide-react'
import type { UserBalanceDetail } from '@/lib/user-balance'
import { UserBalanceSection } from '@/components/users/UserBalanceSection'

export function UserProfileDialog({
  user,
  balance,
  canManagePrivilegedRoles,
}: {
  user: {
    id: string
    name: string
    email: string
    role: string
  }
  balance: UserBalanceDetail
  canManagePrivilegedRoles: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState(user.role)
  const [password, setPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSaving(true)
    try {
      await updateUser(user.id, { name, email, role, password: password || undefined })
      setPassword('')
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Benutzer konnte nicht gespeichert werden.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Benutzer "${user.name}" wirklich löschen?`)) return
    setError(null)
    setIsDeleting(true)
    try {
      const result = await deleteUser(user.id)
      if (!result.success) {
        setError(result.error || 'Benutzer konnte nicht gelöscht werden.')
        return
      }
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Benutzer konnte nicht gelöscht werden.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-1" />
          Profil
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Profil bearbeiten</DialogTitle>
        </DialogHeader>
        <UserBalanceSection balance={balance} />
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`name-${user.id}`}>Name</Label>
            <Input id={`name-${user.id}`} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`email-${user.id}`}>E-Mail</Label>
            <Input id={`email-${user.id}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Rolle</Label>
            {canManagePrivilegedRoles ? (
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super-Admin</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input value={role} readOnly />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`password-${user.id}`}>Neues Passwort (optional)</Label>
            <Input
              id={`password-${user.id}`}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leer lassen, um nicht zu ändern"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {isDeleting ? 'Löschen...' : 'Löschen'}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSaving || isDeleting}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving || isDeleting}>
                {isSaving ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
