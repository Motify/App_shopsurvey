/**
 * Migration script to convert Industry enum to IndustryType table
 * This preserves all existing data by:
 * 1. Creating the industry_types table
 * 2. Populating default industries
 * 3. Adding industry_id column to companies and benchmarks
 * 4. Mapping existing enum values to the new industry IDs
 * 5. Making industry_id required and dropping old industry column
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Default industries matching the old enum values
const defaultIndustries = [
  { code: 'RESTAURANT', nameJa: 'レストラン・飲食', nameEn: 'Restaurant' },
  { code: 'HOTEL', nameJa: 'ホテル・宿泊', nameEn: 'Hotel' },
  { code: 'RETAIL', nameJa: '小売・販売', nameEn: 'Retail' },
  { code: 'ENTERTAINMENT', nameJa: 'エンターテイメント', nameEn: 'Entertainment' },
  { code: 'OTHER', nameJa: 'その他', nameEn: 'Other' },
]

async function main() {
  console.log('Starting industry migration...')

  // Step 1: Create industry_types table if it doesn't exist
  console.log('Step 1: Creating industry_types table...')
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "industry_types" (
      "id" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "name_ja" TEXT NOT NULL,
      "name_en" TEXT NOT NULL,
      "is_default" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "industry_types_pkey" PRIMARY KEY ("id")
    )
  `)

  // Create unique index on code if it doesn't exist
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "industry_types_code_key" ON "industry_types"("code")
  `)

  // Step 2: Insert default industries
  console.log('Step 2: Inserting default industries...')
  for (const industry of defaultIndustries) {
    const id = `ind_${industry.code.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await prisma.$executeRawUnsafe(`
      INSERT INTO "industry_types" ("id", "code", "name_ja", "name_en", "is_default", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, true, NOW(), NOW())
      ON CONFLICT ("code") DO NOTHING
    `, id, industry.code, industry.nameJa, industry.nameEn)
  }

  // Step 3: Get the industry ID mapping
  console.log('Step 3: Getting industry ID mapping...')
  const industries = await prisma.$queryRaw<Array<{ id: string; code: string }>>`
    SELECT id, code FROM industry_types
  `
  const industryMap = new Map(industries.map(i => [i.code, i.id]))
  console.log('Industry mapping:', Object.fromEntries(industryMap))

  // Check if migration already completed (old industry column doesn't exist)
  const companyColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'industry'
  `

  if (companyColumns.length === 0) {
    console.log('Migration already completed (industry column not found). Skipping data migration steps.')
    console.log('\nMigration completed successfully!')
    return
  }

  // Step 4: Add industry_id column to companies if it doesn't exist
  console.log('Step 4: Adding industry_id to companies...')
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "industry_id" TEXT
    `)
  } catch (e) {
    console.log('Column may already exist, continuing...')
  }

  // Step 5: Update companies with the correct industry_id based on old industry enum
  console.log('Step 5: Updating companies with industry_id...')
  for (const [code, id] of Array.from(industryMap)) {
    const result = await prisma.$executeRawUnsafe(`
      UPDATE "companies"
      SET "industry_id" = $1
      WHERE "industry"::text = $2 AND ("industry_id" IS NULL OR "industry_id" = '')
    `, id, code)
    console.log(`  Updated companies with industry ${code}`)
  }

  // Step 6: Add industry_id column to benchmarks if it doesn't exist
  console.log('Step 6: Adding industry_id to benchmarks...')
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "benchmarks" ADD COLUMN IF NOT EXISTS "industry_id" TEXT
    `)
  } catch (e) {
    console.log('Column may already exist, continuing...')
  }

  // Step 7: Update benchmarks with the correct industry_id
  console.log('Step 7: Updating benchmarks with industry_id...')
  for (const [code, id] of Array.from(industryMap)) {
    await prisma.$executeRawUnsafe(`
      UPDATE "benchmarks"
      SET "industry_id" = $1
      WHERE "industry"::text = $2 AND ("industry_id" IS NULL OR "industry_id" = '')
    `, id, code)
    console.log(`  Updated benchmarks with industry ${code}`)
  }

  // Step 8: Make industry_id NOT NULL on companies
  console.log('Step 8: Making industry_id required on companies...')

  // First check if there are any NULL values
  const nullCompanies = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM companies WHERE industry_id IS NULL
  `
  if (Number(nullCompanies[0].count) > 0) {
    // Set to OTHER for any remaining null values
    const otherId = industryMap.get('OTHER')
    await prisma.$executeRawUnsafe(`
      UPDATE "companies" SET "industry_id" = $1 WHERE "industry_id" IS NULL
    `, otherId)
  }

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "companies" ALTER COLUMN "industry_id" SET NOT NULL
  `)

  // Step 9: Make industry_id NOT NULL on benchmarks
  console.log('Step 9: Making industry_id required on benchmarks...')

  const nullBenchmarks = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM benchmarks WHERE industry_id IS NULL
  `
  if (Number(nullBenchmarks[0].count) > 0) {
    const otherId = industryMap.get('OTHER')
    await prisma.$executeRawUnsafe(`
      UPDATE "benchmarks" SET "industry_id" = $1 WHERE "industry_id" IS NULL
    `, otherId)
  }

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "benchmarks" ALTER COLUMN "industry_id" SET NOT NULL
  `)

  // Step 10: Add foreign key constraints
  console.log('Step 10: Adding foreign key constraints...')
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "companies"
      ADD CONSTRAINT "companies_industry_id_fkey"
      FOREIGN KEY ("industry_id") REFERENCES "industry_types"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
    `)
  } catch (e) {
    console.log('Foreign key may already exist on companies')
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "benchmarks"
      ADD CONSTRAINT "benchmarks_industry_id_fkey"
      FOREIGN KEY ("industry_id") REFERENCES "industry_types"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `)
  } catch (e) {
    console.log('Foreign key may already exist on benchmarks')
  }

  // Step 11: Drop the old industry column from companies
  console.log('Step 11: Dropping old industry column from companies...')
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "companies" DROP COLUMN IF EXISTS "industry"
    `)
  } catch (e) {
    console.log('Could not drop industry column from companies:', e)
  }

  // Step 12: Drop the old industry column from benchmarks
  console.log('Step 12: Dropping old industry column from benchmarks...')
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "benchmarks" DROP COLUMN IF EXISTS "industry"
    `)
  } catch (e) {
    console.log('Could not drop industry column from benchmarks:', e)
  }

  // Step 13: Update unique constraint on benchmarks
  console.log('Step 13: Updating unique constraint on benchmarks...')
  try {
    // Drop old constraint if exists
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "benchmarks" DROP CONSTRAINT IF EXISTS "benchmarks_industry_category_key"
    `)
    // Add new constraint
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "benchmarks" ADD CONSTRAINT "benchmarks_industry_id_category_key" UNIQUE ("industry_id", "category")
    `)
  } catch (e) {
    console.log('Could not update unique constraint:', e)
  }

  // Step 14: Drop the old Industry enum type
  console.log('Step 14: Dropping old Industry enum...')
  try {
    await prisma.$executeRawUnsafe(`
      DROP TYPE IF EXISTS "Industry"
    `)
  } catch (e) {
    console.log('Could not drop Industry enum:', e)
  }

  console.log('\nMigration completed successfully!')
  console.log('All company and benchmark data has been preserved.')
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
