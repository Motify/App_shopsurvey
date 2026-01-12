import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateQRCodeBuffer } from '@/lib/qrcode'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    const shop = await prisma.shop.findUnique({
      where: { id },
    })

    if (!shop || shop.companyId !== admin.companyId) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // Generate QR code as PNG buffer
    const qrBuffer = await generateQRCodeBuffer(shop.qrCode, { width: 400 })

    // Sanitize filename
    const filename = `${shop.name.replace(/[^a-zA-Z0-9-_]/g, '_')}-qr.png`

    return new NextResponse(new Uint8Array(qrBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Error generating QR code:', error)
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    )
  }
}
