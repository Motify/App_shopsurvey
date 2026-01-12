import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendAdminInvite } from '@/lib/mailgun'
import Papa from 'papaparse'
import crypto from 'crypto'

interface CSVRow {
  name: string
  email: string
  access_level: string
  assigned_shops: string
}

interface ImportError {
  row: number
  message: string
}

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST /api/admins/import - Import admins from CSV
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
      include: { company: true },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Only full access admins can import
    if (!admin.isFullAccess) {
      return NextResponse.json(
        { error: 'Only full access admins can import admins' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const csvText = await file.text()

    // Parse CSV
    const parseResult = Papa.parse<CSVRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) =>
        header.trim().toLowerCase().replace(/\s+/g, '_'),
    })

    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        { error: 'CSV parsing failed', details: parseResult.errors },
        { status: 400 }
      )
    }

    const rows = parseResult.data

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 })
    }

    // Warn if importing too many at once
    if (rows.length > 50) {
      return NextResponse.json(
        {
          error:
            '一度にインポートできるのは50名までです。CSVを分割してください。',
        },
        { status: 400 }
      )
    }

    // Load existing shops for assignment lookup
    const shops = await prisma.shop.findMany({
      where: { companyId: admin.companyId },
      select: { id: true, name: true },
    })
    const shopNameToId = new Map(shops.map((s) => [s.name.toLowerCase(), s.id]))

    // Check for existing emails
    const emailsInCsv = rows
      .map((r) => r.email?.trim().toLowerCase())
      .filter(Boolean)
    const existingAdmins = await prisma.admin.findMany({
      where: { email: { in: emailsInCsv } },
      select: { email: true },
    })
    const existingEmailSet = new Set(
      existingAdmins.map((a) => a.email.toLowerCase())
    )

    const errors: ImportError[] = []
    let created = 0
    let emailsSent = 0
    const processedEmails = new Set<string>()

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]
      const rowNum = index + 2 // +2 for header and 0-index

      try {
        const name = row.name?.trim()
        const email = row.email?.trim().toLowerCase()
        const accessLevel = row.access_level?.trim().toLowerCase() || 'limited'
        const assignedShopsStr = row.assigned_shops?.trim() || ''

        // Validate name
        if (!name) {
          errors.push({ row: rowNum, message: '名前が空です' })
          continue
        }

        // Validate email
        if (!email) {
          errors.push({ row: rowNum, message: 'メールアドレスが空です' })
          continue
        }

        if (!emailRegex.test(email)) {
          errors.push({
            row: rowNum,
            message: `メールアドレス「${email}」の形式が不正です`,
          })
          continue
        }

        // Check for duplicate in database
        if (existingEmailSet.has(email)) {
          errors.push({
            row: rowNum,
            message: `メールアドレス「${email}」は既に登録されています`,
          })
          continue
        }

        // Check for duplicate within this import
        if (processedEmails.has(email)) {
          errors.push({
            row: rowNum,
            message: `メールアドレス「${email}」がCSV内で重複しています`,
          })
          continue
        }

        // Validate access level
        const isFullAccess = accessLevel === 'full'
        if (accessLevel !== 'full' && accessLevel !== 'limited') {
          errors.push({
            row: rowNum,
            message: `アクセスレベル「${accessLevel}」は無効です（full または limited）`,
          })
          continue
        }

        // Parse and validate assigned shops
        const assignedShopIds: string[] = []
        if (assignedShopsStr && !isFullAccess) {
          const shopNames = assignedShopsStr
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)

          let hasError = false
          for (const shopName of shopNames) {
            const shopId = shopNameToId.get(shopName.toLowerCase())
            if (!shopId) {
              errors.push({
                row: rowNum,
                message: `店舗「${shopName}」が見つかりません`,
              })
              hasError = true
              break
            }
            assignedShopIds.push(shopId)
          }

          if (hasError) continue
        }

        // Create admin
        const inviteToken = crypto.randomUUID()
        const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

        const newAdmin = await prisma.$transaction(async (tx) => {
          const createdAdmin = await tx.admin.create({
            data: {
              companyId: admin.companyId,
              email,
              name,
              isFullAccess,
              status: 'PENDING',
              inviteToken,
              inviteExpiry,
            },
          })

          // Create shop assignments if limited access
          if (!isFullAccess && assignedShopIds.length > 0) {
            await tx.adminShopAssignment.createMany({
              data: assignedShopIds.map((shopId) => ({
                adminId: createdAdmin.id,
                shopId,
              })),
            })
          }

          return createdAdmin
        })

        // Send invite email
        try {
          await sendAdminInvite(email, name, admin.company.name, inviteToken)
          emailsSent++
        } catch (emailError) {
          console.error(`Failed to send invite email to ${email}:`, emailError)
          // Don't fail - admin is created
        }

        created++
        processedEmails.add(email)
        existingEmailSet.add(email) // Prevent duplicates within same import
      } catch (err) {
        errors.push({
          row: rowNum,
          message:
            err instanceof Error ? err.message : '管理者の作成に失敗しました',
        })
      }
    }

    return NextResponse.json({
      created,
      emailsSent,
      errors,
      total: rows.length,
    })
  } catch (error) {
    console.error('Error importing admins:', error)
    return NextResponse.json(
      { error: 'Failed to import admins' },
      { status: 500 }
    )
  }
}
