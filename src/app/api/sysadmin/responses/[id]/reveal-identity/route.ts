import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decryptIdentity } from '@/lib/encryption'
import { z } from 'zod'

export const runtime = 'nodejs'

const revealSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(1000),
  requestedBy: z.string().min(1, 'Requested by is required').max(200),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  // Only SysAdmin can access
  if (!session || session.user.role !== 'sysadmin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validation = revealSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { reason, requestedBy } = validation.data
    const { id: responseId } = await params

    // Get the response
    const response = await prisma.response.findUnique({
      where: { id: responseId },
    })

    if (!response) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 })
    }

    if (!response.encryptedIdentity) {
      return NextResponse.json({ error: 'No identity stored for this response' }, { status: 400 })
    }

    // Get the SysAdmin record
    const sysAdmin = await prisma.sysAdmin.findUnique({
      where: { email: session.user.email! },
    })

    if (!sysAdmin) {
      return NextResponse.json({ error: 'SysAdmin not found' }, { status: 404 })
    }

    // Create audit log BEFORE revealing the identity
    await prisma.identityAccessLog.create({
      data: {
        responseId,
        sysAdminId: sysAdmin.id,
        reason,
        requestedBy,
      },
    })

    // Decrypt and return the identity
    const identity = decryptIdentity(response.encryptedIdentity)

    return NextResponse.json({ identity })
  } catch (error) {
    console.error('Error revealing identity:', error)
    return NextResponse.json(
      { error: 'Failed to reveal identity' },
      { status: 500 }
    )
  }
}
