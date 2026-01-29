import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Papa from 'papaparse'
import crypto from 'crypto'

function generateShortId(length: number = 8): string {
  return crypto.randomBytes(length).toString('base64url').substring(0, length)
}

interface CSVRow {
  shop_number: string
  name: string
  parent_name: string
  address: string
}

interface ImportError {
  row: number
  message: string
}

// POST /api/shops/import - Import shops from CSV
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Only full access admins can import shops
    if (!admin.isFullAccess) {
      return NextResponse.json(
        { error: 'Only full access admins can import shops' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // File size limit: 10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'ファイルサイズは10MB以下にしてください' },
        { status: 400 }
      )
    }

    const csvText = await file.text()

    // Parse CSV
    const parseResult = Papa.parse<CSVRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
    })

    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        { error: 'CSV parsing failed', details: parseResult.errors },
        { status: 400 }
      )
    }

    const rows = parseResult.data

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      )
    }

    // Build map of existing shop names to IDs
    const existingShops = await prisma.shop.findMany({
      where: { companyId: admin.companyId },
      select: { id: true, name: true },
    })

    const shopNameToId = new Map<string, string>()
    existingShops.forEach((shop) => {
      shopNameToId.set(shop.name.toLowerCase(), shop.id)
    })

    // Separate rows into parents (no parent_name) and children
    const parentRows: { row: CSVRow; index: number }[] = []
    const childRows: { row: CSVRow; index: number }[] = []

    rows.forEach((row, index) => {
      if (!row.parent_name || row.parent_name.trim() === '') {
        parentRows.push({ row, index: index + 2 }) // +2 for header and 0-index
      } else {
        childRows.push({ row, index: index + 2 })
      }
    })

    const errors: ImportError[] = []
    let created = 0

    // Process parent rows first
    for (const { row, index } of parentRows) {
      const name = row.name?.trim()

      if (!name) {
        errors.push({ row: index, message: '事業所名が空です' })
        continue
      }

      // Check for duplicates
      if (shopNameToId.has(name.toLowerCase())) {
        errors.push({ row: index, message: `事業所「${name}」は既に存在します` })
        continue
      }

      try {
        const qrCode = `SH-${generateShortId(8)}`
        const shop = await prisma.shop.create({
          data: {
            name,
            shopNumber: row.shop_number?.trim() || null,
            address: row.address?.trim() || null,
            parentId: null,
            qrCode,
            companyId: admin.companyId,
          },
        })
        shopNameToId.set(name.toLowerCase(), shop.id)
        created++
      } catch (err) {
        errors.push({ row: index, message: `事業所「${name}」の作成に失敗しました` })
      }
    }

    // Process child rows
    for (const { row, index } of childRows) {
      const name = row.name?.trim()
      const parentName = row.parent_name?.trim()

      if (!name) {
        errors.push({ row: index, message: '事業所名が空です' })
        continue
      }

      // Check for duplicates
      if (shopNameToId.has(name.toLowerCase())) {
        errors.push({ row: index, message: `事業所「${name}」は既に存在します` })
        continue
      }

      // Find parent
      const parentId = shopNameToId.get(parentName.toLowerCase())
      if (!parentId) {
        errors.push({ row: index, message: `親事業所「${parentName}」が見つかりません` })
        continue
      }

      try {
        const qrCode = `SH-${generateShortId(8)}`
        const shop = await prisma.shop.create({
          data: {
            name,
            shopNumber: row.shop_number?.trim() || null,
            address: row.address?.trim() || null,
            parentId,
            qrCode,
            companyId: admin.companyId,
          },
        })
        shopNameToId.set(name.toLowerCase(), shop.id)
        created++
      } catch (err) {
        errors.push({ row: index, message: `事業所「${name}」の作成に失敗しました` })
      }
    }

    return NextResponse.json({
      created,
      errors,
      total: rows.length,
    })
  } catch (error) {
    console.error('Error importing shops:', error)
    return NextResponse.json(
      { error: 'Failed to import shops' },
      { status: 500 }
    )
  }
}
