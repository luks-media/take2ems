"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { logout } from "@/actions/auth"
import { cn } from "@/lib/utils"

const navLink =
  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-[color,background-color,gap,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"

const morphLabelClass =
  "overflow-hidden whitespace-nowrap origin-left transform-gpu transition-[max-width,opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      className={cn(
        "hidden h-full shrink-0 flex-col overflow-y-auto border-r bg-muted/40 p-2 will-change-[width,padding] transition-[width,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex",
        collapsed ? "md:w-16" : "md:w-64 md:p-4"
      )}
    >
      <div className={cn("mb-4 flex items-center", collapsed ? "justify-center" : "justify-between")}>
        <div
          className={cn(
            `${morphLabelClass} pl-2 text-xl font-bold`,
            collapsed ? "max-w-0 -translate-x-2 scale-x-90 opacity-0" : "max-w-[180px] translate-x-0 scale-x-100 opacity-100"
          )}
        >
          EMS Admin
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
          title={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <nav className="flex flex-col gap-2 flex-1">
        <Link
          href="/"
          className={cn(
            navLink,
            collapsed ? "justify-center px-2" : undefined,
            pathname === "/" ? "bg-muted font-semibold" : "hover:bg-muted"
          )}
          aria-label="Dashboard"
          title="Dashboard"
        >
          <Home className="w-4 h-4" />
          <span
            className={cn(
              morphLabelClass,
              collapsed ? "max-w-0 -translate-x-1.5 scale-x-90 opacity-0" : "max-w-[140px] translate-x-0 scale-x-100 opacity-100"
            )}
          >
            Dashboard
          </span>
        </Link>
        <div
          className={cn(
            "flex items-center gap-1 rounded-md transition-colors duration-200 ease-out motion-reduce:transition-none",
            collapsed ? "justify-center pr-0" : "pr-1",
            pathname.startsWith("/equipment") ? "bg-muted" : "hover:bg-muted"
          )}
        >
          <Link
            href="/equipment"
            className={cn(
              navLink,
              collapsed ? "justify-center px-2" : "flex-1 min-w-0",
              pathname.startsWith("/equipment") ? "font-semibold" : undefined
            )}
            aria-label="Equipment"
            title="Equipment"
          >
            <Package className="w-4 h-4 shrink-0" />
            <span
              className={cn(
                `truncate ${morphLabelClass}`,
                collapsed ? "max-w-0 -translate-x-1.5 scale-x-90 opacity-0" : "max-w-[140px] translate-x-0 scale-x-100 opacity-100"
              )}
            >
              Equipment
            </span>
          </Link>
          {!collapsed ? (
            <Link
              href="/equipment?new=1"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground transition-colors duration-200 ease-out motion-reduce:transition-none hover:border-foreground/45 hover:bg-muted/80 hover:text-foreground"
              aria-label="Neues Equipment"
              title="Neues Equipment"
            >
              <Plus className="w-2.5 h-2.5" strokeWidth={3} />
            </Link>
          ) : null}
        </div>
        <div
          className={cn(
            "flex items-center gap-1 rounded-md transition-colors duration-200 ease-out motion-reduce:transition-none",
            collapsed ? "justify-center pr-0" : "pr-1",
            pathname.startsWith("/rentals") ? "bg-muted" : "hover:bg-muted"
          )}
        >
          <Link
            href="/rentals"
            className={cn(
              navLink,
              collapsed ? "justify-center px-2" : "flex-1 min-w-0",
              pathname.startsWith("/rentals") ? "font-semibold" : undefined
            )}
            aria-label="Ausleihen"
            title="Ausleihen"
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span
              className={cn(
                `truncate ${morphLabelClass}`,
                collapsed ? "max-w-0 -translate-x-1.5 scale-x-90 opacity-0" : "max-w-[140px] translate-x-0 scale-x-100 opacity-100"
              )}
            >
              Ausleihen
            </span>
          </Link>
          {!collapsed ? (
            <Link
              href="/rentals/new"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground transition-colors duration-200 ease-out motion-reduce:transition-none hover:border-foreground/45 hover:bg-muted/80 hover:text-foreground"
              aria-label="Neue Ausleihe"
              title="Neue Ausleihe"
            >
              <Plus className="w-2.5 h-2.5" strokeWidth={3} />
            </Link>
          ) : null}
        </div>
        <Link
          href="/settlements"
          className={cn(
            navLink,
            collapsed ? "justify-center px-2" : undefined,
            pathname.startsWith("/settlements") ? "bg-muted font-semibold" : "hover:bg-muted"
          )}
          aria-label="Abrechnung"
          title="Abrechnung"
        >
          <Receipt className="w-4 h-4" />
          <span
            className={cn(
              morphLabelClass,
              collapsed ? "max-w-0 -translate-x-1.5 scale-x-90 opacity-0" : "max-w-[140px] translate-x-0 scale-x-100 opacity-100"
            )}
          >
            Abrechnung
          </span>
        </Link>
        <Link
          href="/customers"
          className={cn(
            navLink,
            collapsed ? "justify-center px-2" : undefined,
            pathname.startsWith("/customers") ? "bg-muted font-semibold" : "hover:bg-muted"
          )}
          aria-label="Kunden"
          title="Kunden"
        >
          <Library className="w-4 h-4" />
          <span
            className={cn(
              morphLabelClass,
              collapsed ? "max-w-0 -translate-x-1.5 scale-x-90 opacity-0" : "max-w-[140px] translate-x-0 scale-x-100 opacity-100"
            )}
          >
            Kunden
          </span>
        </Link>
        <Link
          href="/users"
          className={cn(
            navLink,
            collapsed ? "justify-center px-2" : undefined,
            pathname.startsWith("/users") ? "bg-muted font-semibold" : "hover:bg-muted"
          )}
          aria-label="Benutzer"
          title="Benutzer"
        >
          <Users className="w-4 h-4" />
          <span
            className={cn(
              morphLabelClass,
              collapsed ? "max-w-0 -translate-x-1.5 scale-x-90 opacity-0" : "max-w-[140px] translate-x-0 scale-x-100 opacity-100"
            )}
          >
            Benutzer
          </span>
        </Link>
        <Link
          href="/settings"
          className={cn(
            navLink,
            collapsed ? "justify-center px-2" : undefined,
            pathname.startsWith("/settings") ? "bg-muted font-semibold" : "hover:bg-muted"
          )}
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
          <span
            className={cn(
              morphLabelClass,
              collapsed ? "max-w-0 -translate-x-1.5 scale-x-90 opacity-0" : "max-w-[140px] translate-x-0 scale-x-100 opacity-100"
            )}
          >
            Settings
          </span>
        </Link>
      </nav>
      <div className="mt-auto pt-4 border-t">
        <Link
          href="/me"
          className={cn(
            navLink,
            collapsed ? "justify-center px-2" : undefined,
            pathname.startsWith("/me") ? "bg-muted font-semibold" : "hover:bg-muted"
          )}
          aria-label="Mein Profil"
          title="Mein Profil"
        >
          <CircleUserRound className="w-4 h-4" />
          <span
            className={cn(
              morphLabelClass,
              collapsed ? "max-w-0 -translate-x-1.5 scale-x-90 opacity-0" : "max-w-[140px] translate-x-0 scale-x-100 opacity-100"
            )}
          >
            Mein Profil
          </span>
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className={cn(
              navLink,
              collapsed ? "justify-center px-2" : undefined,
              "w-full text-destructive hover:bg-muted transition-colors duration-200 ease-out motion-reduce:transition-none"
            )}
            aria-label="Abmelden"
            title="Abmelden"
          >
            <LogOut className="w-4 h-4" />
            <span
              className={cn(
                morphLabelClass,
                collapsed ? "max-w-0 -translate-x-1.5 scale-x-90 opacity-0" : "max-w-[140px] translate-x-0 scale-x-100 opacity-100"
              )}
            >
              Abmelden
            </span>
          </button>
        </form>
      </div>
    </div>
  )
}
