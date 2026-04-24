import prisma from '@/lib/prisma'

export type ActivityLogInput = {
  actorId?: string | null
  entityType: string
  entityId?: string | null
  action: string
  message: string
  details?: unknown
}

function maskEmail(value: string): string {
  const [local, domain] = value.split('@')
  if (!domain) return value
  if (local.length <= 2) return `**@${domain}`
  return `${local.slice(0, 2)}***@${domain}`
}

function sanitizeDetails(value: unknown, keyHint?: string): unknown {
  if (value === null || value === undefined) return value

  const lowerKey = (keyHint || '').toLowerCase()
  const shouldHideFully =
    lowerKey.includes('password') || lowerKey.includes('token') || lowerKey.includes('secret')
  const shouldMaskEmail = lowerKey.includes('email')

  if (typeof value === 'string') {
    if (shouldHideFully) return '[redacted]'
    if (shouldMaskEmail && value.includes('@')) return maskEmail(value)
    return value
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeDetails(entry))
  }

  if (typeof value === 'object') {
    const input = value as Record<string, unknown>
    const output: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input)) {
      output[k] = sanitizeDetails(v, k)
    }
    return output
  }

  return value
}

export async function writeActivityLog(input: ActivityLogInput) {
  const safeDetails = sanitizeDetails(input.details)
  const serializedDetails =
    safeDetails === undefined || safeDetails === null
      ? null
      : typeof safeDetails === 'string'
        ? safeDetails
        : JSON.stringify(safeDetails)

  await prisma.activityLog.create({
    data: {
      actorId: input.actorId ?? null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      message: input.message,
      details: serializedDetails,
    },
  })
}
