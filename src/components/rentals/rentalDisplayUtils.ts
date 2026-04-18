export function rentalStatusDisplay(status: string) {
  switch (status) {
    case 'PENDING':
      return {
        label: 'Ausstehend',
        dot: 'bg-amber-500 shadow-[0_0_12px_-2px_rgba(245,158,11,0.7)]',
        ring: 'ring-amber-500/35',
        badge: 'secondary' as const,
      }
    case 'ACTIVE':
      return {
        label: 'Aktiv',
        dot: 'bg-emerald-500 shadow-[0_0_14px_-2px_rgba(16,185,129,0.65)]',
        ring: 'ring-emerald-500/35',
        badge: 'default' as const,
      }
    case 'RETURNED':
      return {
        label: 'Zurückgegeben',
        dot: 'bg-muted-foreground/50',
        ring: 'ring-muted-foreground/20',
        badge: 'outline' as const,
      }
    case 'CANCELLED':
      return {
        label: 'Storniert',
        dot: 'bg-destructive/80',
        ring: 'ring-destructive/25',
        badge: 'destructive' as const,
      }
    case 'DRAFT':
      return {
        label: 'Entwurf',
        dot: 'bg-slate-400 shadow-[0_0_10px_-2px_rgba(148,163,184,0.6)]',
        ring: 'ring-slate-400/30',
        badge: 'secondary' as const,
      }
    case 'QUOTE':
      return {
        label: 'Angebot',
        dot: 'bg-sky-500 shadow-[0_0_12px_-2px_rgba(14,165,233,0.55)]',
        ring: 'ring-sky-500/30',
        badge: 'outline' as const,
      }
    default:
      return {
        label: status,
        dot: 'bg-primary/60',
        ring: 'ring-primary/20',
        badge: 'secondary' as const,
      }
  }
}
