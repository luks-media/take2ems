import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { resolveSqliteDatabaseFilePath } from '@/lib/sqlite-path'
import { requireAdmin } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Keine Berechtigung.'
    const status = message === 'Nicht angemeldet.' ? 401 : 403
    return new NextResponse(message, { status })
  }

  try {
    const filePath = resolveSqliteDatabaseFilePath()
    if (!filePath) {
      return new NextResponse(
        'Export ist nur für SQLite (DATABASE_URL=file:…) verfügbar.',
        { status: 501 },
      )
    }

    if (!existsSync(filePath)) {
      return new NextResponse('Datenbank-Datei nicht gefunden.', { status: 404 })
    }

    const fileBuffer = readFileSync(filePath)

    const date = new Date().toISOString().split('T')[0]

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Disposition': `attachment; filename="take2ems-backup-${date}.db"`,
        'Content-Type': 'application/x-sqlite3',
      },
    })
  } catch (error) {
    console.error('Fehler beim Exportieren der Datenbank:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
