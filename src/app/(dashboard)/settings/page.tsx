import { cookies } from 'next/headers'
import { DatabaseActions } from './DatabaseActions'
import { SettingsMailCard } from './SettingsMailCard'
import { SettingsAppForm } from './SettingsAppForm'
import { SettingsGoogleCalendarCard } from './SettingsGoogleCalendarCard'
import { SettingsActivityLogCard } from './SettingsActivityLogCard'
import prisma from '@/lib/prisma'
import { decrypt } from '@/actions/auth'
import { getMailSetupSummary } from '@/lib/mail'
import { getAppSettings } from '@/lib/app-settings'
import { getAppOrigin } from '@/lib/app-origin'
import { getGoogleCalendarEnvSummary } from '@/lib/google-calendar/summary'
import { Euro, Package, Users, ChevronRight } from 'lucide-react'
import Link from 'next/link'

async function getSessionUser() {
  const token = cookies().get('auth_session')?.value
  if (!token) return null
  try {
    const session = await decrypt(token)
    return session.user
  } catch {
    return null
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const appVersion = process.env.npm_package_version || '1.0.0'
  const googleParam = typeof searchParams?.google === 'string' ? searchParams.google : undefined
  const googleMessage =
    typeof searchParams?.message === 'string' ? searchParams.message : undefined

  const [equipment, sessionUser, mailSummary, appSettings] = await Promise.all([
    prisma.equipment.findMany({
      select: {
        quantity: true,
        purchasePrice: true,
        dailyRate: true
      }
    }),
    getSessionUser(),
    getMailSetupSummary(),
    getAppSettings(),
  ])
  const gcalEnv = getGoogleCalendarEnvSummary()

  const totalEquipmentValue = equipment.reduce(
    (sum, item) => sum + (item.purchasePrice || 0) * item.quantity,
    0
  )
  const totalDailyRentalPrice = equipment.reduce(
    (sum, item) => sum + (item.dailyRate || 0) * item.quantity,
    0
  )

  const currency = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  })

  const isAdmin = sessionUser?.role === 'ADMIN' || sessionUser?.role === 'SUPER_ADMIN'
  const oauthCallbackUrl = `${getAppOrigin()}/api/google-calendar/callback`

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Einstellungen</h2>
      </div>

      {googleParam === 'connected' && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100">
          Google Calendar wurde verbunden. Du kannst die Synchronisation unten aktivieren.
        </div>
      )}
      {googleParam === 'error' && googleMessage && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Google OAuth: {googleMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              Gesamter Equipmentwert
            </div>
            <p className="text-2xl font-bold">{currency.format(totalEquipmentValue)}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Euro className="h-4 w-4" />
              Gesamter Tagesmietpreis
            </div>
            <p className="text-2xl font-bold">{currency.format(totalDailyRentalPrice)}</p>
          </div>
        </div>
      </div>

      <Link
        href="/users"
        className="flex items-center justify-between gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="font-semibold">Benutzer</div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Interne Nutzer, Rollen, Lagerorte und Kontostände verwalten.
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SettingsMailCard
          summary={mailSummary}
          isAdmin={isAdmin}
          defaultTestRecipient={sessionUser?.email}
        />
        {isAdmin ? (
          <SettingsAppForm initial={appSettings} />
        ) : (
          <div className="rounded-xl border bg-muted/20 p-6 text-sm text-muted-foreground">
            PDF- und Ausleihe-Defaults können nur von Administratoren bearbeitet werden.
          </div>
        )}
      </div>

      <SettingsGoogleCalendarCard
        initial={appSettings}
        envSummary={gcalEnv}
        oauthCallbackUrl={oauthCallbackUrl}
        isAdmin={isAdmin}
      />

      <SettingsActivityLogCard searchParams={searchParams} />
      
      <DatabaseActions isAdmin={isAdmin} />

      <div className="pt-2 text-xs text-muted-foreground">
        Version {appVersion}
      </div>
    </div>
  )
}
