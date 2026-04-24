'use client'

import { useState } from 'react'
import { changeOwnPassword } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setPending(true)
    try {
      const fd = new FormData(e.currentTarget)
      const result = await changeOwnPassword(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        e.currentTarget.reset()
      }
    } catch {
      setError('Passwort konnte nicht geändert werden.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">Neues Passwort</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">Mindestens 8 Zeichen.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Neues Passwort bestätigen</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-700 dark:text-green-400">Passwort wurde geändert.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Speichern...' : 'Passwort speichern'}
      </Button>
    </form>
  )
}
