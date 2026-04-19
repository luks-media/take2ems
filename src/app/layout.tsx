import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Equipment Management System',
  description: 'EMS Dashboard',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body className="min-h-screen antialiased font-sans">{children}</body>
    </html>
  )
}
