import { NextResponse } from 'next/server'
import { writeFileSync, existsSync, copyFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { resolveSqliteDatabaseFilePath } from '@/lib/sqlite-path'
import { requireAdmin } from '@/lib/session'

export async function POST(request: Request) {
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
        'Import ist nur für SQLite (DATABASE_URL=file:…) verfügbar.',
        { status: 501 },
      )
    }

    const formData = await request.formData()
    const file = formData.get('dbFile') as File | null

    if (!file) {
      return new NextResponse('Keine Datei hochgeladen.', { status: 400 })
    }

    if (!file.name.endsWith('.db')) {
      return new NextResponse('Ungültiges Dateiformat. Nur .db-Dateien sind erlaubt.', { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    mkdirSync(dirname(filePath), { recursive: true })

    // Backup der alten Datenbank
    const backupPath = `${filePath}.backup-${Date.now()}`
    try {
        if (existsSync(filePath)) {
            copyFileSync(filePath, backupPath)
        }
    } catch (e) {
        console.error("Konnte kein lokales Backup der alten DB erstellen", e)
    }

    writeFileSync(filePath, buffer)

    return new NextResponse('Datenbank erfolgreich importiert.', { status: 200 })
  } catch (error) {
    console.error('Fehler beim Importieren der Datenbank:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
