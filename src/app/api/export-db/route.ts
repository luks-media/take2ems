import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { resolveSqliteDatabaseFilePath } from '@/lib/sqlite-path'

export const dynamic = 'force-dynamic'

export async function GET() {
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
