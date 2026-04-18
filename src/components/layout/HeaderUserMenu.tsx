'use client'

import Link from 'next/link'
import { LayoutDashboard, KeyRound, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { logout } from '@/actions/auth'
import type { HeaderUserProfile } from '@/lib/session'

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'
}

export function HeaderUserMenu({ user }: { user: HeaderUserProfile }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full border bg-muted font-medium text-sm shrink-0"
          aria-label="Benutzermenü"
        >
          {initials(user.name)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end" sideOffset={8}>
        <div className="px-3 py-3 border-b">
          <p className="font-medium truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          <p className="text-xs text-muted-foreground mt-1">{user.role}</p>
        </div>
        <div className="p-1 flex flex-col">
          <Button variant="ghost" className="justify-start gap-2 h-9 px-2" asChild>
            <Link href="/me">
              <LayoutDashboard className="h-4 w-4" />
              Mein Bereich
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start gap-2 h-9 px-2" asChild>
            <Link href="/me#passwort">
              <KeyRound className="h-4 w-4" />
              Passwort ändern
            </Link>
          </Button>
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start gap-2 h-9 px-2 text-destructive hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Abmelden
            </Button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  )
}
