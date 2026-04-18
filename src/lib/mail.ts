import nodemailer from 'nodemailer'

function getSmtpConfig() {
  const host = process.env.SMTP_HOST
  const portRaw = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM

  if (!host || !portRaw || !user || !pass || !from) {
    return null
  }

  const port = Number.parseInt(portRaw, 10)
  if (!Number.isFinite(port)) {
    return null
  }

  return {
    host,
    port,
    user,
    pass,
    from,
    secure: port === 465,
  }
}

function createTransport() {
  const smtp = getSmtpConfig()
  if (!smtp) {
    throw new Error('SMTP ist nicht konfiguriert.')
  }
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  })
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null
}

export function isAppUrlConfigured(): boolean {
  return Boolean(
    (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().length > 0
  )
}

export function getMailSetupSummary() {
  return {
    smtpReady: isSmtpConfigured(),
    smtpHostSet: Boolean(process.env.SMTP_HOST),
    smtpPortSet: Boolean(process.env.SMTP_PORT),
    smtpUserSet: Boolean(process.env.SMTP_USER),
    smtpPassSet: Boolean(process.env.SMTP_PASS),
    smtpFromSet: Boolean(process.env.SMTP_FROM),
    appUrlReady: isAppUrlConfigured(),
  }
}

export async function sendTestEmail(to: string) {
  const smtp = getSmtpConfig()
  if (!smtp) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`SMTP nicht konfiguriert. Test-Mail wuerde an ${to} gehen.`)
      return
    }
    throw new Error('SMTP ist nicht konfiguriert.')
  }

  const transporter = createTransport()
  await transporter.sendMail({
    from: smtp.from,
    to,
    subject: 'Take2EMS Test-Mail',
    text: 'Dies ist eine Test-Mail aus den Einstellungen. SMTP funktioniert.',
    html: '<p>Dies ist eine Test-Mail aus den Einstellungen. SMTP funktioniert.</p>',
  })
}
