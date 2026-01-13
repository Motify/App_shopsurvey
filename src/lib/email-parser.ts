import Papa from 'papaparse'

export interface ParseResult {
  valid: string[]
  invalid: { email: string; reason: string }[]
  duplicates: number
}

export interface MultiShopEmailEntry {
  email: string
  shopNumber?: string
  shopName?: string
}

export interface MultiShopParseResult {
  entries: MultiShopEmailEntry[]
  invalid: { email: string; reason: string }[]
  duplicates: number
  hasShopInfo: boolean
}

interface CSVRow {
  email?: string
  shop_number?: string
  shopnumber?: string
  shop_name?: string
  shopname?: string
  [key: string]: string | undefined
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

export function parseEmailCSV(csvContent: string, existingEmails: string[] = []): ParseResult {
  const parsed = Papa.parse<CSVRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  })

  const results: ParseResult = {
    valid: [],
    invalid: [],
    duplicates: 0,
  }

  // Include existing emails in the seen set to detect duplicates
  const seen = new Set<string>(existingEmails.map(e => e.toLowerCase()))

  for (const row of parsed.data) {
    // Try to get email from 'email' column or first column
    let email = row.email?.trim().toLowerCase()

    // If no 'email' column, try the first column
    if (!email) {
      const firstKey = Object.keys(row)[0]
      if (firstKey) {
        email = row[firstKey]?.trim().toLowerCase()
      }
    }

    if (!email) continue

    // Check duplicate
    if (seen.has(email)) {
      results.duplicates++
      continue
    }
    seen.add(email)

    // Validate format
    if (!EMAIL_REGEX.test(email)) {
      results.invalid.push({ email, reason: '無効な形式' })
      continue
    }

    results.valid.push(email)
  }

  return results
}

export function parseMultiShopEmailCSV(
  csvContent: string,
  existingEmails: string[] = []
): MultiShopParseResult {
  const parsed = Papa.parse<CSVRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase().replace(/[\s-]/g, '_'),
  })

  const results: MultiShopParseResult = {
    entries: [],
    invalid: [],
    duplicates: 0,
    hasShopInfo: false,
  }

  // Include existing emails in the seen set to detect duplicates
  const seen = new Set<string>(existingEmails.map(e => e.toLowerCase()))

  // Check if CSV has shop columns
  const headers = parsed.meta.fields || []
  const hasShopNumber = headers.some(h => h === 'shop_number' || h === 'shopnumber')
  const hasShopName = headers.some(h => h === 'shop_name' || h === 'shopname')
  results.hasShopInfo = hasShopNumber || hasShopName

  for (const row of parsed.data) {
    // Try to get email from 'email' column or first column
    let email = row.email?.trim().toLowerCase()

    // If no 'email' column, try the first column
    if (!email) {
      const firstKey = Object.keys(row)[0]
      if (firstKey) {
        email = row[firstKey]?.trim().toLowerCase()
      }
    }

    if (!email) continue

    // Check duplicate
    if (seen.has(email)) {
      results.duplicates++
      continue
    }
    seen.add(email)

    // Validate format
    if (!EMAIL_REGEX.test(email)) {
      results.invalid.push({ email, reason: '無効な形式' })
      continue
    }

    // Get shop info
    const shopNumber = (row.shop_number || row.shopnumber)?.trim() || undefined
    const shopName = (row.shop_name || row.shopname)?.trim() || undefined

    results.entries.push({
      email,
      shopNumber,
      shopName,
    })
  }

  return results
}

export function parseEmailText(text: string, existingEmails: string[] = []): ParseResult {
  const results: ParseResult = {
    valid: [],
    invalid: [],
    duplicates: 0,
  }

  // Include existing emails in the seen set
  const seen = new Set<string>(existingEmails.map(e => e.toLowerCase()))

  // Split by comma, newline, semicolon, or space
  const emails = text.split(/[,\n;\s]+/).filter(Boolean)

  for (const rawEmail of emails) {
    const email = rawEmail.trim().toLowerCase()

    if (!email) continue

    // Check duplicate
    if (seen.has(email)) {
      results.duplicates++
      continue
    }
    seen.add(email)

    // Validate format
    if (!EMAIL_REGEX.test(email)) {
      results.invalid.push({ email, reason: '無効な形式' })
      continue
    }

    results.valid.push(email)
  }

  return results
}
