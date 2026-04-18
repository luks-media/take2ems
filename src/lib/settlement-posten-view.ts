export type SettlementPostenView = 'kacheln' | 'auftragsliste' | 'zeilen'

export function resolveSettlementPostenView(
  param: string | string[] | undefined
): SettlementPostenView {
  const v = Array.isArray(param) ? param[0] : param
  if (v === 'auftragsliste' || v === 'zeilen' || v === 'kacheln') return v
  return 'kacheln'
}
