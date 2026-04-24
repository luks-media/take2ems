import { Menu } from 'lucide-react'

export async function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center border-b bg-background px-6 lg:h-[60px]">
      <button
        type="button"
        className="md:hidden mr-4 rounded-md p-1.5 text-foreground transition-colors duration-200 ease-out motion-reduce:transition-none hover:bg-muted active:scale-95 motion-reduce:active:scale-100"
        aria-label="Menü"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="w-full flex-1 min-w-0" />
    </header>
  )
}
