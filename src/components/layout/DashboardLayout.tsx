import { Suspense } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

function HeaderFallback() {
  return (
    <header className="flex items-center h-14 px-6 border-b lg:h-[60px] bg-background shrink-0">
      <div className="flex-1" />
      <div className="h-9 w-9 rounded-full bg-muted border animate-pulse" />
    </header>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Suspense fallback={<HeaderFallback />}>
          <Header />
        </Suspense>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
