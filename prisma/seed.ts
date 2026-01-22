import { PrismaClient, QuestionCategory, Industry } from '@prisma/client'
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
    textJa: '困った時に店長に相談しやすいですか？',
    textEn: 'Is it easy to consult with your manager when you have problems?',
    category: QuestionCategory.MANAGER_LEADERSHIP,
    isReversed: false,
    isOutcome: false,
    scale: '1-5',
  },
  {
    order: 2,
    textJa: '店長はスタッフを公平に扱っていますか？',
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

// Industry benchmarks for the 8 driver dimensions + SKILLS_GROWTH
const benchmarks = [
  // RESTAURANT industry benchmarks
  { industry: Industry.RESTAURANT, category: QuestionCategory.MANAGER_LEADERSHIP, avgScore: 3.4, sampleSize: 1000 },
  { industry: Industry.RESTAURANT, category: QuestionCategory.SCHEDULE_HOURS, avgScore: 3.2, sampleSize: 1000 },
  { industry: Industry.RESTAURANT, category: QuestionCategory.TEAMWORK, avgScore: 3.5, sampleSize: 1000 },
  { industry: Industry.RESTAURANT, category: QuestionCategory.WORKLOAD_STAFFING, avgScore: 3.2, sampleSize: 1000 },
  { industry: Industry.RESTAURANT, category: QuestionCategory.RESPECT_RECOGNITION, avgScore: 3.3, sampleSize: 1000 },
  { industry: Industry.RESTAURANT, category: QuestionCategory.PAY_BENEFITS, avgScore: 3.0, sampleSize: 1000 },
  { industry: Industry.RESTAURANT, category: QuestionCategory.WORK_ENVIRONMENT, avgScore: 3.4, sampleSize: 1000 },
  { industry: Industry.RESTAURANT, category: QuestionCategory.SKILLS_GROWTH, avgScore: 3.1, sampleSize: 1000 },

  // HOTEL industry benchmarks
  { industry: Industry.HOTEL, category: QuestionCategory.MANAGER_LEADERSHIP, avgScore: 3.5, sampleSize: 800 },
  { industry: Industry.HOTEL, category: QuestionCategory.SCHEDULE_HOURS, avgScore: 3.3, sampleSize: 800 },
  { industry: Industry.HOTEL, category: QuestionCategory.TEAMWORK, avgScore: 3.6, sampleSize: 800 },
  { industry: Industry.HOTEL, category: QuestionCategory.WORKLOAD_STAFFING, avgScore: 3.1, sampleSize: 800 },
  { industry: Industry.HOTEL, category: QuestionCategory.RESPECT_RECOGNITION, avgScore: 3.4, sampleSize: 800 },
  { industry: Industry.HOTEL, category: QuestionCategory.PAY_BENEFITS, avgScore: 3.2, sampleSize: 800 },
  { industry: Industry.HOTEL, category: QuestionCategory.WORK_ENVIRONMENT, avgScore: 3.5, sampleSize: 800 },
  { industry: Industry.HOTEL, category: QuestionCategory.SKILLS_GROWTH, avgScore: 3.3, sampleSize: 800 },

  // RETAIL industry benchmarks
  { industry: Industry.RETAIL, category: QuestionCategory.MANAGER_LEADERSHIP, avgScore: 3.3, sampleSize: 1200 },
  { industry: Industry.RETAIL, category: QuestionCategory.SCHEDULE_HOURS, avgScore: 3.1, sampleSize: 1200 },
  { industry: Industry.RETAIL, category: QuestionCategory.TEAMWORK, avgScore: 3.4, sampleSize: 1200 },
  { industry: Industry.RETAIL, category: QuestionCategory.WORKLOAD_STAFFING, avgScore: 3.0, sampleSize: 1200 },
  { industry: Industry.RETAIL, category: QuestionCategory.RESPECT_RECOGNITION, avgScore: 3.2, sampleSize: 1200 },
  { industry: Industry.RETAIL, category: QuestionCategory.PAY_BENEFITS, avgScore: 2.9, sampleSize: 1200 },
  { industry: Industry.RETAIL, category: QuestionCategory.WORK_ENVIRONMENT, avgScore: 3.3, sampleSize: 1200 },
  { industry: Industry.RETAIL, category: QuestionCategory.SKILLS_GROWTH, avgScore: 3.0, sampleSize: 1200 },

  // ENTERTAINMENT industry benchmarks
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.MANAGER_LEADERSHIP, avgScore: 3.6, sampleSize: 500 },
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.SCHEDULE_HOURS, avgScore: 3.4, sampleSize: 500 },
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.TEAMWORK, avgScore: 3.7, sampleSize: 500 },
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.WORKLOAD_STAFFING, avgScore: 3.3, sampleSize: 500 },
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.RESPECT_RECOGNITION, avgScore: 3.5, sampleSize: 500 },
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.PAY_BENEFITS, avgScore: 3.1, sampleSize: 500 },
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.WORK_ENVIRONMENT, avgScore: 3.6, sampleSize: 500 },
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.SKILLS_GROWTH, avgScore: 3.4, sampleSize: 500 },

  // OTHER industry benchmarks
  { industry: Industry.OTHER, category: QuestionCategory.MANAGER_LEADERSHIP, avgScore: 3.4, sampleSize: 600 },
  { industry: Industry.OTHER, category: QuestionCategory.SCHEDULE_HOURS, avgScore: 3.2, sampleSize: 600 },
  { industry: Industry.OTHER, category: QuestionCategory.TEAMWORK, avgScore: 3.5, sampleSize: 600 },
  { industry: Industry.OTHER, category: QuestionCategory.WORKLOAD_STAFFING, avgScore: 3.1, sampleSize: 600 },
  { industry: Industry.OTHER, category: QuestionCategory.RESPECT_RECOGNITION, avgScore: 3.3, sampleSize: 600 },
  { industry: Industry.OTHER, category: QuestionCategory.PAY_BENEFITS, avgScore: 3.0, sampleSize: 600 },
  { industry: Industry.OTHER, category: QuestionCategory.WORK_ENVIRONMENT, avgScore: 3.4, sampleSize: 600 },
  { industry: Industry.OTHER, category: QuestionCategory.SKILLS_GROWTH, avgScore: 3.2, sampleSize: 600 },
]

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

  // Clear existing benchmarks and re-seed
  await prisma.benchmark.deleteMany({})

  // Seed benchmarks
  for (const benchmark of benchmarks) {
    await prisma.benchmark.create({
      data: benchmark,
    })
  }
  console.log(`Seeded ${benchmarks.length} benchmarks`)

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

  // Create the company
  const company = await prisma.company.create({
    data: {
      name: companyName,
      industry: Industry.RESTAURANT,
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
