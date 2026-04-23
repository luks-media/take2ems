'use client'

import { Button } from '@/components/ui/button'

type AdminOnlyButtonProps = {
  label: string
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function AdminOnlyButton({ label, size = 'default', className }: AdminOnlyButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={className}
      onClick={() => {
        alert('Nur Administratoren dürfen diese Aktion ausführen.')
      }}
    >
      {label}
    </Button>
  )
}
