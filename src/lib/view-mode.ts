export type DirectoryViewMode = 'grid' | 'list'

export function resolveViewMode(
  viewParam: string | string[] | undefined,
  defaultMode: DirectoryViewMode
): DirectoryViewMode {
  const v = Array.isArray(viewParam) ? viewParam[0] : viewParam
  if (v === 'list' || v === 'grid') return v
  return defaultMode
}
