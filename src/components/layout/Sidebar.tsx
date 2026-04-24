"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Settings,
  Package,
  Home,
  Calendar,
  Plus,
  LogOut,
  Receipt,
  Library,
  Users,
  CircleUserRound,
} from "lucide-react"
import { logout } from "@/actions/auth"
import { cn } from "@/lib/utils"

const navLink =
  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ease-out motion-reduce:transition-none"

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden h-full shrink-0 flex-col overflow-y-auto border-r bg-muted/40 md:flex md:w-64 p-4">
      <div className="font-bold text-xl mb-8 pl-2">EMS Admin</div>
      <nav className="flex flex-col gap-2 flex-1">
        <Link
          href="/"
          className={cn(navLink, pathname === "/" ? "bg-muted font-semibold" : "hover:bg-muted")}
        >
          <Home className="w-4 h-4" />
          Dashboard
        </Link>
        <div
          className={cn(
            "flex items-center gap-1 rounded-md pr-1 transition-colors duration-200 ease-out motion-reduce:transition-none",
            pathname.startsWith("/equipment") ? "bg-muted" : "hover:bg-muted"
          )}
        >
          <Link
            href="/equipment"
            className={cn(
              navLink,
              "flex-1 min-w-0",
              pathname.startsWith("/equipment") ? "font-semibold" : undefined
            )}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span className="truncate">Equipment</span>
          </Link>
          <Link
            href="/equipment?new=1"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground transition-colors duration-200 ease-out motion-reduce:transition-none hover:border-foreground/45 hover:bg-muted/80 hover:text-foreground"
            aria-label="Neues Equipment"
            title="Neues Equipment"
          >
            <Plus className="w-2.5 h-2.5" strokeWidth={3} />
          </Link>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 rounded-md pr-1 transition-colors duration-200 ease-out motion-reduce:transition-none",
            pathname.startsWith("/rentals") ? "bg-muted" : "hover:bg-muted"
          )}
        >
          <Link
            href="/rentals"
            className={cn(
              navLink,
              "flex-1 min-w-0",
              pathname.startsWith("/rentals") ? "font-semibold" : undefined
            )}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="truncate">Ausleihen</span>
          </Link>
          <Link
            href="/rentals/new"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground transition-colors duration-200 ease-out motion-reduce:transition-none hover:border-foreground/45 hover:bg-muted/80 hover:text-foreground"
            aria-label="Neue Ausleihe"
            title="Neue Ausleihe"
          >
            <Plus className="w-2.5 h-2.5" strokeWidth={3} />
          </Link>
        </div>
        <Link
          href="/settlements"
          className={cn(
            navLink,
            pathname.startsWith("/settlements") ? "bg-muted font-semibold" : "hover:bg-muted"
          )}
        >
          <Receipt className="w-4 h-4" />
          Abrechnung
        </Link>
        <Link
          href="/customers"
          className={cn(
            navLink,
            pathname.startsWith("/customers") ? "bg-muted font-semibold" : "hover:bg-muted"
          )}
        >
          <Library className="w-4 h-4" />
          Kunden
        </Link>
        <Link
          href="/users"
          className={cn(
            navLink,
            pathname.startsWith("/users") ? "bg-muted font-semibold" : "hover:bg-muted"
          )}
        >
          <Users className="w-4 h-4" />
          Benutzer
        </Link>
        <Link
          href="/settings"
          className={cn(
            navLink,
            pathname.startsWith("/settings") ? "bg-muted font-semibold" : "hover:bg-muted"
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
      </nav>
      <div className="mt-auto pt-4 border-t">
        <Link
          href="/me"
          className={cn(navLink, pathname.startsWith("/me") ? "bg-muted font-semibold" : "hover:bg-muted")}
        >
          <CircleUserRound className="w-4 h-4" />
          Mein Profil
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className={cn(
              navLink,
              "w-full text-destructive hover:bg-muted transition-colors duration-200 ease-out motion-reduce:transition-none"
            )}
          >
            <LogOut className="w-4 h-4" />
            Abmelden
          </button>
        </form>
      </div>
    </div>
  )
}
