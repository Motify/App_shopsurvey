import { PrismaClient, QuestionCategory } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

// Helper function to generate a random score within a range
function randomScore(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10
}

// Generate a random integer between min and max (inclusive)
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Generate a unique QR code
function generateQRCode(): string {
  return randomUUID().replace(/-/g, '').substring(0, 12)
}

// 12 questions based on the framework:
// Q1-Q9: 8 Dimensions (drivers of retention) - 1-5 scale
// Q10: Retention Intention (outcome measure) - 1-5 scale
// Q11: eNPS (outcome measure) - 0-10 scale
// Q12: Free text (not stored in questions table, handled in survey form)
const questions = [
  {
    order: 1,
    textJa: '困った時にマネジャーに相談しやすいですか？',
    textEn: 'Is it easy to consult with your manager when you have problems?',
    category: QuestionCategory.MANAGER_LEADERSHIP,
    isReversed: false,
    isOutcome: false,
    scale: '1-5',
  },
  {
    order: 2,
    textJa: 'マネジャーはスタッフを公平に扱っていますか？',
    textEn: 'Does your manager treat staff fairly?',
    category: QuestionCategory.MANAGER_LEADERSHIP,
    isReversed: false,
    isOutcome: false,
    scale: '1-5',
  },
  {
    order: 3,
    textJa: '希望のシフトに入れていますか？',
    textEn: 'Are you able to work your preferred shifts?',
    category: QuestionCategory.SCHEDULE_HOURS,
    isReversed: false,
    isOutcome: false,
    scale: '1-5',
  },
  {
    order: 4,
    textJa: '忙しい時、チームで助け合えていますか？',
    textEn: 'Does your team help each other during busy times?',
    category: QuestionCategory.TEAMWORK,
    isReversed: false,
    isOutcome: false,
    scale: '1-5',
  },
  {
    order: 5,
    textJa: '人手が足りないと感じることはありますか？',
    textEn: 'Do you feel there is a shortage of staff?',
    category: QuestionCategory.WORKLOAD_STAFFING,
    isReversed: true, // Higher = more shortage = bad
    isOutcome: false,
    scale: '1-5',
  },
  {
    order: 6,
    textJa: '自分の頑張りは認められていると感じますか？',
    textEn: 'Do you feel your efforts are recognized?',
    category: QuestionCategory.RESPECT_RECOGNITION,
    isReversed: false,
    isOutcome: false,
    scale: '1-5',
  },
  {
    order: 7,
    textJa: '今の給与・待遇に納得していますか？',
    textEn: 'Are you satisfied with your current pay and benefits?',
    category: QuestionCategory.PAY_BENEFITS,
    isReversed: false,
    isOutcome: false,
    scale: '1-5',
  },
  {
    order: 8,
    textJa: '休憩は十分に取れていますか？',
    textEn: 'Are you able to take adequate breaks?',
    category: QuestionCategory.WORK_ENVIRONMENT,
    isReversed: false,
    isOutcome: false,
    scale: '1-5',
  },
  {
    order: 9,
    textJa: '新しい仕事を覚える機会がありますか？',
    textEn: 'Do you have opportunities to learn new tasks?',
    category: QuestionCategory.SKILLS_GROWTH,
    isReversed: false,
    isOutcome: false,
    scale: '1-5',
  },
  {
    order: 10,
    textJa: '半年後もこの職場で働いていると思いますか？',
    textEn: 'Do you think you will still be working here in 6 months?',
    category: QuestionCategory.RETENTION_INTENTION,
    isReversed: false,
    isOutcome: true, // Outcome measure
    scale: '1-5',
  },
  {
    order: 11,
    textJa: 'この職場を友人や知人に働く場所として勧めますか？',
    textEn: 'How likely are you to recommend this workplace to a friend?',
    category: QuestionCategory.ENPS,
    isReversed: false,
    isOutcome: true, // Outcome measure
    scale: '0-10',
  },
]

// Default industries with Japanese and English names
const defaultIndustries = [
  { code: 'RESTAURANT', nameJa: 'レストラン・飲食', nameEn: 'Restaurant' },
  { code: 'HOTEL', nameJa: 'ホテル・宿泊', nameEn: 'Hotel' },
  { code: 'RETAIL', nameJa: '小売・販売', nameEn: 'Retail' },
  { code: 'ENTERTAINMENT', nameJa: 'エンターテイメント', nameEn: 'Entertainment' },
  { code: 'OTHER', nameJa: 'その他', nameEn: 'Other' },
]

// Industry benchmarks for the 8 driver dimensions + SKILLS_GROWTH
// Will be populated with industryId after industries are created
const benchmarkData: Record<string, Array<{ category: QuestionCategory; avgScore: number; sampleSize: number }>> = {
  RESTAURANT: [
    { category: QuestionCategory.MANAGER_LEADERSHIP, avgScore: 3.4, sampleSize: 1000 },
    { category: QuestionCategory.SCHEDULE_HOURS, avgScore: 3.2, sampleSize: 1000 },
    { category: QuestionCategory.TEAMWORK, avgScore: 3.5, sampleSize: 1000 },
    { category: QuestionCategory.WORKLOAD_STAFFING, avgScore: 3.2, sampleSize: 1000 },
    { category: QuestionCategory.RESPECT_RECOGNITION, avgScore: 3.3, sampleSize: 1000 },
    { category: QuestionCategory.PAY_BENEFITS, avgScore: 3.0, sampleSize: 1000 },
    { category: QuestionCategory.WORK_ENVIRONMENT, avgScore: 3.4, sampleSize: 1000 },
    { category: QuestionCategory.SKILLS_GROWTH, avgScore: 3.1, sampleSize: 1000 },
  ],
  HOTEL: [
    { category: QuestionCategory.MANAGER_LEADERSHIP, avgScore: 3.5, sampleSize: 800 },
    { category: QuestionCategory.SCHEDULE_HOURS, avgScore: 3.3, sampleSize: 800 },
    { category: QuestionCategory.TEAMWORK, avgScore: 3.6, sampleSize: 800 },
    { category: QuestionCategory.WORKLOAD_STAFFING, avgScore: 3.1, sampleSize: 800 },
    { category: QuestionCategory.RESPECT_RECOGNITION, avgScore: 3.4, sampleSize: 800 },
    { category: QuestionCategory.PAY_BENEFITS, avgScore: 3.2, sampleSize: 800 },
    { category: QuestionCategory.WORK_ENVIRONMENT, avgScore: 3.5, sampleSize: 800 },
    { category: QuestionCategory.SKILLS_GROWTH, avgScore: 3.3, sampleSize: 800 },
  ],
  RETAIL: [
    { category: QuestionCategory.MANAGER_LEADERSHIP, avgScore: 3.3, sampleSize: 1200 },
    { category: QuestionCategory.SCHEDULE_HOURS, avgScore: 3.1, sampleSize: 1200 },
    { category: QuestionCategory.TEAMWORK, avgScore: 3.4, sampleSize: 1200 },
    { category: QuestionCategory.WORKLOAD_STAFFING, avgScore: 3.0, sampleSize: 1200 },
    { category: QuestionCategory.RESPECT_RECOGNITION, avgScore: 3.2, sampleSize: 1200 },
    { category: QuestionCategory.PAY_BENEFITS, avgScore: 2.9, sampleSize: 1200 },
    { category: QuestionCategory.WORK_ENVIRONMENT, avgScore: 3.3, sampleSize: 1200 },
    { category: QuestionCategory.SKILLS_GROWTH, avgScore: 3.0, sampleSize: 1200 },
  ],
  ENTERTAINMENT: [
    { category: QuestionCategory.MANAGER_LEADERSHIP, avgScore: 3.6, sampleSize: 500 },
    { category: QuestionCategory.SCHEDULE_HOURS, avgScore: 3.4, sampleSize: 500 },
    { category: QuestionCategory.TEAMWORK, avgScore: 3.7, sampleSize: 500 },
    { category: QuestionCategory.WORKLOAD_STAFFING, avgScore: 3.3, sampleSize: 500 },
    { category: QuestionCategory.RESPECT_RECOGNITION, avgScore: 3.5, sampleSize: 500 },
    { category: QuestionCategory.PAY_BENEFITS, avgScore: 3.1, sampleSize: 500 },
    { category: QuestionCategory.WORK_ENVIRONMENT, avgScore: 3.6, sampleSize: 500 },
    { category: QuestionCategory.SKILLS_GROWTH, avgScore: 3.4, sampleSize: 500 },
  ],
  OTHER: [
    { category: QuestionCategory.MANAGER_LEADERSHIP, avgScore: 3.4, sampleSize: 600 },
    { category: QuestionCategory.SCHEDULE_HOURS, avgScore: 3.2, sampleSize: 600 },
    { category: QuestionCategory.TEAMWORK, avgScore: 3.5, sampleSize: 600 },
    { category: QuestionCategory.WORKLOAD_STAFFING, avgScore: 3.1, sampleSize: 600 },
    { category: QuestionCategory.RESPECT_RECOGNITION, avgScore: 3.3, sampleSize: 600 },
    { category: QuestionCategory.PAY_BENEFITS, avgScore: 3.0, sampleSize: 600 },
    { category: QuestionCategory.WORK_ENVIRONMENT, avgScore: 3.4, sampleSize: 600 },
    { category: QuestionCategory.SKILLS_GROWTH, avgScore: 3.2, sampleSize: 600 },
  ],
}

async function main() {
  console.log('Seeding database...')

  // Create test SysAdmin
  const hashedPassword = await bcrypt.hash('password123', 12)
  await prisma.sysAdmin.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      passwordHash: hashedPassword,
      name: 'Test Admin',
    },
  })
  console.log('Created test SysAdmin (admin@test.com / password123)')

  // Clear existing questions and re-seed
  await prisma.question.deleteMany({})

  // Seed questions
  for (const question of questions) {
    await prisma.question.create({
      data: question,
    })
  }
  console.log(`Seeded ${questions.length} questions`)

  // Seed default industries
  const industryMap: Record<string, string> = {} // code -> id
  for (const industry of defaultIndustries) {
    const created = await prisma.industryType.upsert({
      where: { code: industry.code },
      update: {},
      create: {
        code: industry.code,
        nameJa: industry.nameJa,
        nameEn: industry.nameEn,
        isDefault: true,
      },
    })
    industryMap[industry.code] = created.id
  }
  console.log(`Seeded ${defaultIndustries.length} industries`)

  // Clear existing benchmarks and re-seed
  await prisma.benchmark.deleteMany({})

  // Seed benchmarks
  let benchmarkCount = 0
  for (const [industryCode, benchmarks] of Object.entries(benchmarkData)) {
    const industryId = industryMap[industryCode]
    if (!industryId) continue

    for (const benchmark of benchmarks) {
      await prisma.benchmark.create({
        data: {
          industryId,
          category: benchmark.category,
          avgScore: benchmark.avgScore,
          sampleSize: benchmark.sampleSize,
        },
      })
      benchmarkCount++
    }
  }
  console.log(`Seeded ${benchmarkCount} benchmarks`)

  // Create fake company with shops and survey responses
  await createFakeCompanyWithData()

  console.log('Seeding completed!')
}

// Create a fake company with 10 shops and 10 employees per shop
async function createFakeCompanyWithData() {
  const companyName = 'サンプル株式会社'

  // Check if company already exists
  const existingCompany = await prisma.company.findFirst({
    where: { name: companyName }
  })

  if (existingCompany) {
    console.log(`Company "${companyName}" already exists, skipping...`)
    return
  }

  // Get the RESTAURANT industry
  const restaurantIndustry = await prisma.industryType.findUnique({
    where: { code: 'RESTAURANT' },
  })

  if (!restaurantIndustry) {
    console.log('RESTAURANT industry not found, skipping company creation')
    return
  }

  // Create the company
  const company = await prisma.company.create({
    data: {
      name: companyName,
      industryId: restaurantIndustry.id,
      status: 'ACTIVE',
    },
  })
  console.log(`Created company: ${company.name}`)

  // Create admin for the company
  const hashedPassword = await bcrypt.hash('password123', 12)
  const admin = await prisma.admin.create({
    data: {
      companyId: company.id,
      email: 'sample@test.com',
      passwordHash: hashedPassword,
      name: 'サンプル管理者',
      isFullAccess: true,
      status: 'ACTIVE',
    },
  })
  console.log(`Created admin: ${admin.email} / password123`)

  // Shop names (Japanese restaurant/cafe names)
  const shopNames = [
    '新宿店',
    '渋谷店',
    '池袋店',
    '銀座店',
    '品川店',
    '上野店',
    '秋葉原店',
    '六本木店',
    '表参道店',
    '横浜店',
  ]

  // Create 10 shops
  const shops = []
  for (const shopName of shopNames) {
    const shop = await prisma.shop.create({
      data: {
        companyId: company.id,
        name: shopName,
        qrCode: generateQRCode(),
        status: 'ACTIVE',
      },
    })
    shops.push(shop)
  }
  console.log(`Created ${shops.length} shops`)

  // Create survey responses for each shop (10 employees per shop)
  let totalResponses = 0

  // Generate responses over the past 6 months
  const now = new Date()

  for (const shop of shops) {
    // Create 10 responses per shop
    for (let i = 0; i < 10; i++) {
      // Randomize submission date within the last 6 months
      const daysAgo = randomInt(1, 180)
      const submittedAt = new Date(now)
      submittedAt.setDate(submittedAt.getDate() - daysAgo)

      // Generate scores with some variation per shop
      // Each shop has a base score modifier to create variation between shops
      const shopModifier = (shops.indexOf(shop) - 5) * 0.15 // -0.75 to +0.75

      // Generate answers for Q1-Q10 (1-5 scale)
      const answers: Record<string, number> = {}
      for (let q = 1; q <= 10; q++) {
        // Base score around 3.5 with variation
        let score = 3.5 + shopModifier + randomScore(-1, 1)
        // Clamp to 1-5 range
        score = Math.max(1, Math.min(5, Math.round(score)))
        answers[`q${q}`] = score
      }

      // Generate eNPS score (0-10 scale)
      // Based on overall satisfaction
      const avgScore = Object.values(answers).reduce((a, b) => a + b, 0) / 10
      let enpsScore = Math.round((avgScore - 1) * 2.5) // Map 1-5 to 0-10
      enpsScore = Math.max(0, Math.min(10, enpsScore + randomInt(-2, 2)))

      // Some employees leave improvement suggestions
      const improvementTexts = [
        null,
        null,
        null,
        '休憩時間をもう少し取れるようにしてほしい',
        'シフトの融通をもう少しきかせてほしい',
        '給与アップを希望します',
        'チームのコミュニケーションを改善したい',
        null,
        null,
        '新しいスキルを学べる機会がもっとほしい',
      ]

      await prisma.response.create({
        data: {
          shopId: shop.id,
          answers,
          enpsScore,
          improvementText: improvementTexts[i],
          submittedAt,
        },
      })
      totalResponses++
    }
  }

  console.log(`Created ${totalResponses} survey responses`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
