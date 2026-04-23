'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Upload, Database, Loader2 } from 'lucide-react'

export function DatabaseActions({ isAdmin }: { isAdmin: boolean }) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const adminOnlyMessage = 'Nur Administratoren dürfen diese Aktion ausführen.'

  const handleAdminOnlyAttempt = () => {
    if (!isAdmin) {
      alert(adminOnlyMessage)
      return true
    }
    return false
  }

  const handleExport = () => {
    if (handleAdminOnlyAttempt()) return
    window.location.href = '/api/export-db'
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (handleAdminOnlyAttempt()) {
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.db')) {
      alert('Bitte lade nur eine gültige SQLite-Datenbank (.db) hoch.')
      return
    }

    if (!confirm('Bist du sicher? Die aktuelle Datenbank wird überschrieben! Es wird vorher automatisch ein lokales Backup ([Datei].backup-[Zeitstempel]) auf dem Server erstellt.')) {
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setIsUploading(true)

    const formData = new FormData()
    formData.append('dbFile', file)

    try {
      const response = await fetch('/api/import-db', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        alert('Datenbank erfolgreich wiederhergestellt! Die Seite wird nun neu geladen.')
        window.location.reload()
      } else {
        const errorText = await response.text()
        alert(`Fehler beim Hochladen: ${errorText}`)
      }
    } catch (error) {
      console.error(error)
      alert('Ein unerwarteter Fehler ist aufgetreten.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Export Card */}
      <div className="rounded-xl border bg-card text-card-foreground shadow">
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Database className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold leading-none tracking-tight">Datenbank Export</h3>
            <p className="text-sm text-muted-foreground">
              Lade die aktuelle SQLite-Datenbank (laut DATABASE_URL) zur sicheren Aufbewahrung herunter.
            </p>
          </div>
          <div className="pt-2 w-full">
            <Button
              className="w-full flex items-center justify-center gap-2"
              variant={isAdmin ? 'default' : 'outline'}
              onClick={handleExport}
            >
              <Download className="w-4 h-4" />
              Backup herunterladen
            </Button>
            {!isAdmin && (
              <p className="mt-2 text-xs text-muted-foreground">
                Nur Admins können Datenbank-Backups exportieren.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Import Card */}
      <div className="rounded-xl border bg-card text-card-foreground shadow">
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold leading-none tracking-tight">Datenbank Import</h3>
            <p className="text-sm text-muted-foreground">
              Stelle ein vorheriges Backup (.db) wieder her. Die aktuelle Datenbank wird dabei überschrieben!
            </p>
          </div>
          <div className="pt-2 w-full">
            <input
              type="file"
              accept=".db"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              id="db-upload"
            />
            <Button
              variant={isAdmin ? 'secondary' : 'outline'}
              className="w-full flex items-center justify-center gap-2"
              onClick={() => {
                if (handleAdminOnlyAttempt()) return
                fileInputRef.current?.click()
              }}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {isUploading ? 'Wird hochgeladen...' : 'Backup hochladen'}
            </Button>
            {!isAdmin && (
              <p className="mt-2 text-xs text-muted-foreground">
                Nur Admins können Datenbank-Backups importieren.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
