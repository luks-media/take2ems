import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { getHeaderUserProfile } from '@/lib/session'
import { getUserBalancesMap } from '@/lib/user-balance'
import { UserBalanceSection } from '@/components/users/UserBalanceSection'
import { ChangePasswordForm } from '@/components/me/ChangePasswordForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MePage() {
  const user = await getHeaderUserProfile()
  if (!user) {
    redirect('/login')
  }

  const balances = await getUserBalancesMap()
  const balance = balances[user.id]

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="max-w-3xl space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/" aria-label="Zurück zum Dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mein Bereich</h1>
          <p className="text-muted-foreground">Persönliche Übersicht und Kontoeinstellungen</p>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-6 shadow-sm space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Profil</h2>
        <p className="text-lg font-medium">{user.name}</p>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <div className="pt-2">
          <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>{user.role}</Badge>
        </div>
      </section>

      {balance && <UserBalanceSection balance={balance} />}

      <section id="passwort" className="rounded-xl border bg-card p-6 shadow-sm scroll-mt-24 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Passwort</h2>
        <p className="text-sm text-muted-foreground">
          Ändere dein Passwort mit dem aktuellen Passwort zur Bestätigung.
        </p>
        <ChangePasswordForm />
      </section>
      </div>
    </div>
  )
}
