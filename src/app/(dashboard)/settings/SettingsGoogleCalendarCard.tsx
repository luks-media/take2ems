'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, CheckCircle2, XCircle } from 'lucide-react'
import type { AppSettings } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  disconnectGoogleCalendarAction,
  updateGoogleCalendarSettingsAction,
} from '@/actions/settings'

type EnvSummary = {
  clientConfigured: boolean
  tokenSecretReady: boolean
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

export function SettingsGoogleCalendarCard({
  initial,
  envSummary,
  oauthCallbackUrl,
  isAdmin,
}: {
  initial: AppSettings
  envSummary: EnvSummary
  oauthCallbackUrl: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const connected = Boolean(initial.googleCalendarRefreshTokenEnc)
  const [calendarId, setCalendarId] = useState(initial.googleCalendarId ?? '')
  const [syncEnabled, setSyncEnabled] = useState(initial.googleCalendarSyncEnabled)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)
  const [disconnectPending, setDisconnectPending] = useState(false)

  const envReady =
    envSummary.clientConfigured && envSummary.tokenSecretReady && envSummary.appUrlReady

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setPending(true)
    try {
      const fd = new FormData()
      fd.set('googleCalendarId', calendarId)
      fd.set('googleCalendarSyncEnabled', syncEnabled ? 'true' : 'false')
      const result = await updateGoogleCalendarSettingsAction(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        router.refresh()
      }
    } catch {
      setError('Speichern fehlgeschlagen.')
    } finally {
      setPending(false)
    }
  }

  async function handleDisconnect() {
    setError(null)
    setSuccess(false)
    setDisconnectPending(true)
    try {
      const d = await disconnectGoogleCalendarAction()
      if (d && 'error' in d && d.error) {
        setError(d.error)
      } else {
        router.refresh()
      }
    } catch {
      setError('Trennen fehlgeschlagen.')
    } finally {
      setDisconnectPending(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow">
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold leading-none tracking-tight">Google Kalender</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Firmenkalender per OAuth verbinden. Neue und geänderte Ausleihen werden als ganztägige
          Termine synchronisiert (bei Storno wird der Termin entfernt). Redirect-URI in der Google
          Cloud Console:{' '}
          <code className="text-xs bg-muted px-1 rounded break-all">{oauthCallbackUrl}</code>
        </p>

        <div className="rounded-md border bg-muted/30 p-3 space-y-1">
          <StatusRow ok={envSummary.clientConfigured} label="GOOGLE_CLIENT_ID / SECRET" />
          <StatusRow ok={envSummary.tokenSecretReady} label="GOOGLE_TOKEN_SECRET (16+ Zeichen)" />
          <StatusRow ok={envSummary.appUrlReady} label="APP_URL / NEXT_PUBLIC_APP_URL" />
        </div>

        {isAdmin ? (
          <>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <p className="text-sm">
                Status:{' '}
                {connected ? (
                  <span className="text-green-700 font-medium">Verbunden</span>
                ) : (
                  <span className="text-muted-foreground">Nicht verbunden</span>
                )}
              </p>
              {envReady && (
                <Button type="button" variant="secondary" size="sm" asChild>
                  <a href="/api/google-calendar/connect">Mit Google verbinden</a>
                </Button>
              )}
              {connected && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disconnectPending}
                  onClick={() => void handleDisconnect()}
                >
                  {disconnectPending ? 'Trenne...' : 'Verbindung trennen'}
                </Button>
              )}
            </div>

            <form onSubmit={handleSave} className="space-y-4 pt-2 border-t max-w-xl">
              <div className="space-y-2">
                <Label htmlFor="googleCalendarId">Kalender-ID (optional)</Label>
                <Input
                  id="googleCalendarId"
                  value={calendarId}
                  onChange={(e) => setCalendarId(e.target.value)}
                  placeholder="primary oder z. B. xxxx@group.calendar.google.com"
                />
                <p className="text-xs text-muted-foreground">
                  Leer lassen für den Hauptkalender des verbundenen Kontos (<code>primary</code>).
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="googleCalendarSyncEnabled"
                  checked={syncEnabled}
                  onCheckedChange={(v) => setSyncEnabled(v === true)}
                />
                <Label htmlFor="googleCalendarSyncEnabled" className="font-normal cursor-pointer">
                  Synchronisation aktiv (benoetigt Verbindung und gueltige Umgebungsvariablen)
                </Label>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-green-700">Einstellungen gespeichert.</p>}
              <Button type="submit" disabled={pending}>
                {pending ? 'Speichere...' : 'Kalender-Einstellungen speichern'}
              </Button>
            </form>
          </>
        ) : (
          <p className="text-xs text-muted-foreground pt-2 border-t">
            Nur Administratoren können Google Calendar verbinden.
          </p>
        )}
      </div>
    </div>
  )
}
