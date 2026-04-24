'use client'

import { useState } from 'react'
import { Mail, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sendSettingsTestEmail } from '@/actions/settings'

type MailSummary = {
  smtpReady: boolean
  smtpHostSet: boolean
  smtpPortSet: boolean
  smtpUserSet: boolean
  smtpPassSet: boolean
  smtpFromSet: boolean
  appUrlReady: boolean
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="OK" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive" aria-label="Fehlt" />
      )}
    </div>
  )
}

export function SettingsMailCard({
  summary,
  isAdmin,
  defaultTestRecipient,
}: {
  summary: MailSummary
  isAdmin: boolean
  defaultTestRecipient?: string
}) {
  const [email, setEmail] = useState(defaultTestRecipient || '')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleTestSend(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setError(null)
    setPending(true)
    try {
      const fd = new FormData()
      fd.set('to', email)
      const result = await sendSettingsTestEmail(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        setMessage('Test-Mail wurde gesendet (sofern SMTP erreichbar ist).')
      }
    } catch {
      setError('Versand fehlgeschlagen.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow">
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="font-semibold leading-none tracking-tight">E-Mail &amp; Passwort-Reset</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Fuer Passwort-Reset und Test-Mails werden SMTP-Umgebungsvariablen benoetigt.{' '}
          <code className="text-xs bg-muted px-1 rounded">APP_URL</code> verbessert die Links in
          Reset-Mails.
        </p>

        <div className="rounded-md border bg-muted/30 p-3 space-y-1">
          <StatusRow ok={summary.smtpReady} label="SMTP vollstaendig" />
          <StatusRow ok={summary.smtpHostSet} label="SMTP_HOST" />
          <StatusRow ok={summary.smtpPortSet} label="SMTP_PORT" />
          <StatusRow ok={summary.smtpUserSet} label="SMTP_USER" />
          <StatusRow ok={summary.smtpPassSet} label="SMTP_PASS" />
          <StatusRow ok={summary.smtpFromSet} label="SMTP_FROM" />
          <StatusRow ok={summary.appUrlReady} label="APP_URL / NEXT_PUBLIC_APP_URL" />
        </div>

        {isAdmin ? (
          <form onSubmit={handleTestSend} className="space-y-3 pt-2 border-t">
            <div className="space-y-2">
              <Label htmlFor="test-mail-to">Test-Mail an</Label>
              <Input
                id="test-mail-to"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deine@mail.de"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-green-700">{message}</p>}
            <Button type="submit" variant="secondary" disabled={pending || !summary.smtpReady}>
              {pending ? 'Sende...' : 'Test-Mail senden'}
            </Button>
            {!summary.smtpReady && (
              <p className="text-xs text-muted-foreground">
                Test-Mail ist deaktiviert, bis SMTP konfiguriert ist. In Development kannst du die
                Variablen setzen und den Dev-Server neu starten.
              </p>
            )}
          </form>
        ) : (
          <p className="text-xs text-muted-foreground pt-2 border-t">
            Nur Administratoren können Test-Mails senden.
          </p>
        )}
      </div>
    </div>
  )
}
