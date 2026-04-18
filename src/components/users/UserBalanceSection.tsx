'use client'

import type { UserBalanceDetail } from '@/lib/user-balance'

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

export function UserBalanceSection({ balance }: { balance: UserBalanceDetail }) {
  const { netSaldo, totalOwnerIncome, totalBorrowerExpense, owedToOthers, owedByOthers } = balance
  const positive = netSaldo >= 0

  return (
    <section className="rounded-lg border bg-muted/20 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground mb-2">
          Virtueller Kontostand
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Ausstehende, aktive und zurückgegebene Ausleihen (ohne Storno). Mieter zahlt den
          Gesamtpreis; Eigentümer-Anteile ergeben Forderungen zwischen Nutzern.
        </p>
        <div
          className={`text-2xl font-bold ${positive ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}
        >
          {positive ? '+' : ''}
          {eur.format(netSaldo)}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {positive ? 'Netto-Forderung / Guthaben' : 'Netto-Verbindlichkeit'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border bg-background/60 p-2">
          <div className="text-muted-foreground text-xs">Einnahmen (Anteile)</div>
          <div className="font-medium">{eur.format(totalOwnerIncome)}</div>
        </div>
        <div className="rounded-md border bg-background/60 p-2">
          <div className="text-muted-foreground text-xs">Ausgaben (als Mieter)</div>
          <div className="font-medium">{eur.format(totalBorrowerExpense)}</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Du schuldest
          </h4>
          {owedToOthers.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {owedToOthers.map((row) => (
                <li key={row.userId} className="flex justify-between gap-2">
                  <span className="truncate">{row.userName}</span>
                  <span className="font-medium shrink-0">{eur.format(row.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Dir geschuldet
          </h4>
          {owedByOthers.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {owedByOthers.map((row) => (
                <li key={row.userId} className="flex justify-between gap-2">
                  <span className="truncate">{row.userName}</span>
                  <span className="font-medium shrink-0">{eur.format(row.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
