import { prisma } from './prisma'
import { AuditAction, Prisma } from '@prisma/client'

export { AuditAction }

export interface AuditLogParams {
  action: AuditAction
  userId?: string
  userEmail?: string
  userRole?: string
  targetType?: string
  targetId?: string
  ipAddress?: string
  userAgent?: string
  details?: Prisma.InputJsonValue
}

/**
 * Log an audit event
 * Non-blocking - errors are caught and logged but don't throw
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        userId: params.userId,
        userEmail: params.userEmail,
        userRole: params.userRole,
        targetType: params.targetType,
        targetId: params.targetId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        details: params.details ?? undefined,
      },
    })
  } catch (error) {
    // Log error but don't throw - audit logging should not break main flow
    console.error('Failed to create audit log:', error)
  }
}

/**
 * Extract audit context from a request
 */
export function getAuditContext(request: Request): {
  ipAddress: string
  userAgent: string
} {
  const forwarded = request.headers.get('x-forwarded-for')
  const ipAddress = forwarded
    ? forwarded.split(',')[0].trim()
    : request.headers.get('x-real-ip') ?? 'unknown'

  const userAgent = request.headers.get('user-agent') ?? 'unknown'

  return { ipAddress, userAgent }
}

/**
 * Helper to log admin actions
 */
export async function logAdminAction(
  action: AuditAction,
  request: Request,
  user: { id: string; email: string; role: string },
  target?: { type: string; id: string },
  details?: Prisma.InputJsonValue
): Promise<void> {
  const { ipAddress, userAgent } = getAuditContext(request)

  await logAuditEvent({
    action,
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    targetType: target?.type,
    targetId: target?.id,
    ipAddress,
    userAgent,
    details,
  })
}

/**
 * Helper to log authentication events
 */
export async function logAuthEvent(
  action: AuditAction,
  request: Request,
  email: string,
  success: boolean,
  userId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const { ipAddress, userAgent } = getAuditContext(request)

  await logAuditEvent({
    action,
    userId,
    userEmail: email,
    ipAddress,
    userAgent,
    details: {
      ...details,
      success,
    } as Prisma.InputJsonValue,
  })
}
