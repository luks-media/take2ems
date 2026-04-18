import type { ComponentPropsWithoutRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Camera,
  Clapperboard,
  Lightbulb,
  Mic2,
  Package,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Entspricht den Kategorien aus `createEquipment` / Formularen. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Kamera: Camera,
  Licht: Lightbulb,
  Ton: Mic2,
  Grip: Wrench,
  Production: Clapperboard,
  Misc: Package,
}

export function getEquipmentCategoryIcon(category: string | null | undefined): LucideIcon {
  if (category == null || typeof category !== 'string') {
    return Package
  }
  const t = category.trim()
  if (!t) return Package
  if (CATEGORY_ICONS[t]) return CATEGORY_ICONS[t]
  const k = Object.keys(CATEGORY_ICONS).find((a) => a.toLowerCase() === t.toLowerCase())
  return k ? CATEGORY_ICONS[k]! : Package
}

type IconProps = {
  category: string | null | undefined
  className?: string
} & ComponentPropsWithoutRef<'svg'>

export function EquipmentCategoryIcon({ category, className, ...props }: IconProps) {
  const Icon = getEquipmentCategoryIcon(category)
  return <Icon className={cn('shrink-0', className)} aria-hidden {...props} />
}
