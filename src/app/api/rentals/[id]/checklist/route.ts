import { NextResponse } from 'next/server'
import type { Browser } from 'puppeteer'
import { cookies } from 'next/headers'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import prisma from '@/lib/prisma'
import { decrypt } from '@/actions/auth'
import { getAppSettings } from '@/lib/app-settings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RentalForChecklist = Awaited<ReturnType<typeof getRentalForChecklist>>

async function getRentalForChecklist(id: string) {
  return prisma.rental.findUnique({
    where: { id },
    include: {
      user: true,
      items: {
        include: {
          equipment: {
            include: {
              location: true,
            },
          },
        },
      },
    },
  })
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatDate(value: Date) {
  return format(value, 'dd.MM.yyyy', { locale: de })
}

function formatCurrency(value: number) {
  return `${value.toFixed(2)} EUR`
}

type PdfBranding = {
  companyLine: string | null
  contactLine: string | null
  footerLine: string | null
}

type RentalItemRow = NonNullable<RentalForChecklist>['items'][number]

function groupItemsByLocation(items: RentalItemRow[]) {
  const groupsMap = new Map<string, { label: string; items: RentalItemRow[] }>()
  for (const item of items) {
    const id = item.equipment.locationId ?? '__none__'
    const label = item.equipment.location?.name?.trim() || 'Ohne Lagerort'
    let g = groupsMap.get(id)
    if (!g) {
      g = { label, items: [] }
      groupsMap.set(id, g)
    }
    g.items.push(item)
  }
  return Array.from(groupsMap.entries()).sort((a, b) => {
    if (a[0] === '__none__') return 1
    if (b[0] === '__none__') return -1
    return a[1].label.localeCompare(b[1].label, 'de')
  })
}

function buildChecklistHtml(rental: NonNullable<RentalForChecklist>, branding: PdfBranding) {
  const today = formatDate(new Date())
  const customerName = escapeHtml(rental.customerName?.trim() || 'Nicht angegeben')
  const borrowerName = escapeHtml(rental.user?.name || 'Unbekannt')
  const borrowerEmail = escapeHtml(rental.user?.email || '-')
  const period = `${formatDate(rental.startDate)} - ${formatDate(rental.endDate)} (${rental.totalDays} Tage)`
  const periodEscaped = escapeHtml(period)
  const borrowerNote = rental.borrowerNote?.trim() || ''
  const borrowerNoteHtml = borrowerNote
    ? `<div class="note-text">${escapeHtml(borrowerNote).replaceAll('\n', '<br />')}</div>`
    : ''
  const totalItems = rental.items.reduce((sum, item) => sum + item.quantity, 0)
  const originalPrice = rental.items.reduce(
    (sum, item) => sum + item.dailyRate * item.quantity * rental.totalDays,
    0
  )
  const discountAmount = Math.max(
    0,
    Number(((rental.discountAmount ?? originalPrice - rental.totalPrice) || 0).toFixed(2))
  )
  const discountPercent = originalPrice > 0 ? Number(((discountAmount / originalPrice) * 100).toFixed(2)) : 0
  const locationGroups = groupItemsByLocation(rental.items)

  const subtitleLine = (branding.companyLine?.trim() || 'Take2EMS').trim()
  const subtitleEscaped = escapeHtml(subtitleLine)
  const contactRaw = branding.contactLine?.trim()
  const contactHtml = contactRaw
    ? `<div class="muted" style="margin-top:4px">${escapeHtml(contactRaw)}</div>`
    : ''
  const footerText =
    branding.footerLine?.trim() ||
    'Diese Liste dient als Checkliste für Ausgabe und Rücknahme des Equipments.'
  const footerEscaped = escapeHtml(footerText)

  let pos = 0
  const itemRows = locationGroups
    .map(([, group]) => {
      const headerLabel = escapeHtml(group.label)
      const headerRow = `
        <tr class="location-header">
          <td colspan="9">Lagerort: ${headerLabel}</td>
        </tr>`
      const dataRows = group.items
        .map((item: RentalItemRow) => {
          pos += 1
          const equipmentCode = escapeHtml(item.equipment.equipmentCode)
          const equipmentName = escapeHtml(item.equipment.name)
          const noteRaw = item.note?.trim()
          const noteHtml = noteRaw
            ? `<div class="muted" style="font-size:10px;margin-top:3px;white-space:pre-wrap">${escapeHtml(noteRaw)}</div>`
            : ''
          const equipNoteRaw = item.equipment.internalNote?.trim()
          const equipNoteHtml = equipNoteRaw
            ? `<div class="muted" style="font-size:10px;margin-top:2px;font-style:italic">Artikel-Notiz: ${escapeHtml(equipNoteRaw)}</div>`
            : ''
          return `
        <tr>
          <td>${pos}</td>
          <td>${equipmentCode}</td>
          <td>${equipmentName}${equipNoteHtml}${noteHtml}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.dailyRate)}</td>
          <td>${formatCurrency(item.totalPrice)}</td>
          <td><span class="pdf-checkbox"></span></td>
          <td><span class="pdf-checkbox"></span></td>
          <td><span class="pdf-checkbox"></span></td>
        </tr>`
        })
        .join('')
      return headerRow + dataRows
    })
    .join('')

  const signatureBoxes = locationGroups
    .map(([, group]) => {
      const title = escapeHtml(group.label)
      return `
      <div class="signature-box">
        <strong>Lagerort: ${title}</strong>
        <div class="signature-sub">Ausgabe</div>
        <div class="signature-line">Datum / Unterschrift</div>
        <div class="signature-sub">Rückgabe</div>
        <div class="signature-line">Datum / Unterschrift</div>
      </div>`
    })
    .join('')

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>Ausleihliste ${escapeHtml(rental.id)}</title>
    <style>
      @page { size: A4; margin: 16mm 12mm; }
      * { box-sizing: border-box; }
      body {
        font-family: Arial, Helvetica, sans-serif;
        color: #111;
        font-size: 12px;
        line-height: 1.35;
      }
      h1 {
        margin: 0;
        font-size: 20px;
      }
      h2 {
        margin: 0 0 8px 0;
        font-size: 14px;
      }
      .muted { color: #555; }
      .header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 14px;
        margin-bottom: 14px;
      }
      .meta-card {
        border: 1px solid #d8d8d8;
        border-radius: 6px;
        padding: 8px;
      }
      .meta-label {
        font-size: 11px;
        color: #555;
      }
      .meta-value {
        font-size: 13px;
        margin-top: 2px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
      }
      th, td {
        border: 1px solid #d8d8d8;
        padding: 6px;
        vertical-align: top;
      }
      th {
        background: #f5f5f5;
        font-size: 11px;
        text-align: left;
      }
      tr.location-header td {
        background: #ececec;
        font-weight: bold;
        font-size: 12px;
        text-align: left;
      }
      td:nth-child(1),
      td:nth-child(4),
      td:nth-child(7),
      td:nth-child(8),
      td:nth-child(9) {
        text-align: center;
      }
      tr.location-header td:nth-child(1) {
        text-align: left;
      }
      .total-row {
        margin-top: 10px;
        text-align: right;
        font-size: 13px;
        font-weight: bold;
      }
      .pdf-checkbox {
        display: inline-block;
        width: 12px;
        height: 12px;
        border: 1.5px solid #333;
        border-radius: 2px;
        background: #fff;
        vertical-align: middle;
      }
      @media print {
        .pdf-checkbox {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
      }
      .notes {
        margin-top: 14px;
        border: 1px solid #d8d8d8;
        border-radius: 6px;
        padding: 10px;
        min-height: 92px;
      }
      .lines {
        margin-top: 8px;
      }
      .line {
        border-bottom: 1px solid #aaa;
        height: 18px;
        margin-bottom: 6px;
      }
      .note-text {
        margin-top: 8px;
        font-size: 12px;
        white-space: normal;
      }
      .signatures {
        margin-top: 16px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 14px;
      }
      .signature-box {
        border: 1px solid #d8d8d8;
        border-radius: 6px;
        padding: 10px;
      }
      .signature-line {
        border-bottom: 1px solid #888;
        margin-top: 22px;
        padding-top: 4px;
        font-size: 11px;
        color: #555;
      }
      .signature-sub {
        font-size: 11px;
        color: #444;
        margin-top: 12px;
        font-weight: 600;
      }
      .signature-box .signature-line {
        margin-top: 16px;
      }
      .footer {
        margin-top: 10px;
        font-size: 10px;
        color: #666;
      }
      .price-box {
        margin-top: 10px;
        border: 1px solid #d8d8d8;
        border-radius: 6px;
        padding: 8px;
        width: 280px;
        margin-left: auto;
      }
      .price-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 12px;
        margin-bottom: 2px;
      }
      .price-row.total {
        margin-top: 5px;
        padding-top: 5px;
        border-top: 1px solid #d8d8d8;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>Ausleihliste</h1>
        <div class="muted">${subtitleEscaped}</div>
        ${contactHtml}
      </div>
      <div class="muted">
        Erstellt am: ${today}<br />
        Ausleihe-ID: ${escapeHtml(rental.id)}
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-card">
        <div class="meta-label">Kunde / Projekt</div>
        <div class="meta-value">${customerName}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Zeitraum</div>
        <div class="meta-value">${periodEscaped}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Bearbeiter</div>
        <div class="meta-value">${borrowerName} (${borrowerEmail})</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Umfang</div>
        <div class="meta-value">${totalItems} Teile</div>
      </div>
    </div>

    <h2>Checkliste Equipment</h2>
    <table>
      <thead>
        <tr>
          <th>Pos</th>
          <th>Code</th>
          <th>Artikel</th>
          <th>Menge</th>
          <th>Tagessatz</th>
          <th>Gesamt</th>
          <th>Ausgabe</th>
          <th>Rückgabe</th>
          <th>OK</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="price-box">
      <div class="price-row">
        <span>Originalpreis</span>
        <span>${escapeHtml(formatCurrency(originalPrice))}</span>
      </div>
      <div class="price-row">
        <span>Rabatt</span>
        <span>- ${escapeHtml(formatCurrency(discountAmount))} (${discountPercent.toFixed(2)}%)</span>
      </div>
      <div class="price-row total">
        <span>Gesamtpreis</span>
        <span>${escapeHtml(formatCurrency(rental.totalPrice))}</span>
      </div>
    </div>

    <div class="notes">
      <strong>Notizen für den Ausleiher</strong>
      ${borrowerNoteHtml}
      <div class="lines">
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
      </div>
    </div>

    <div class="signatures">
      ${signatureBoxes}
    </div>

    <div class="footer">
      ${footerEscaped}
    </div>
  </body>
</html>`
}

async function requireSession() {
  const sessionToken = cookies().get('auth_session')?.value
  if (!sessionToken) {
    return null
  }

  try {
    return await decrypt(sessionToken)
  } catch {
    return null
  }
}

function buildFilename(rental: NonNullable<RentalForChecklist>) {
  const datePart = format(rental.startDate, 'yyyy-MM-dd')
  const customerPart =
    rental.customerName
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'ausleihe'

  return `ausleihliste-${datePart}-${customerPart}.pdf`
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await requireSession()
  if (!session) {
    return new NextResponse('Nicht autorisiert.', { status: 401 })
  }

  const rental = await getRentalForChecklist(params.id)
  if (!rental) {
    return new NextResponse('Ausleihe nicht gefunden.', { status: 404 })
  }

  const appSettings = await getAppSettings()
  const branding: PdfBranding = {
    companyLine: appSettings.pdfCompanyLine,
    contactLine: appSettings.pdfContactLine,
    footerLine: appSettings.pdfFooterLine,
  }

  const { default: puppeteer } = await import('puppeteer')
  let browser: Browser | null = null

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      // Docker: system Chromium (see Dockerfile). Locally: omit for bundled Chrome.
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    })

    const page = await browser.newPage()
    await page.setContent(buildChecklistHtml(rental, branding), { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    })

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${buildFilename(rental)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Fehler beim Erstellen der Ausleihliste:', error)
    return new NextResponse('Fehler beim Erstellen der PDF-Datei.', { status: 500 })
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
