import { PrismaClient, QuestionCategory, QuestionType, Industry } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// 11 questions based on the framework:
// Q1-Q9: 5-point scale (1-5)
// Q10: eNPS (0-10 scale)
// Q11: Free text
const questions = [
  {
    order: 1,
    textJa: '困った時に店長に相談しやすいですか？',
    textEn: 'Is it easy to consult with your manager when you have problems?',
    category: QuestionCategory.MANAGER_LEADERSHIP,
    questionType: QuestionType.SCALE_5,
    isReverse: false,
  },
  {
    order: 2,
    textJa: '店長はスタッフを公平に扱っていますか？',
    textEn: 'Does your manager treat staff fairly?',
    category: QuestionCategory.MANAGER_LEADERSHIP,
    questionType: QuestionType.SCALE_5,
    isReverse: false,
  },
  {
    order: 3,
    textJa: '希望のシフトに入れていますか？',
    textEn: 'Are you able to get the shifts you want?',
    category: QuestionCategory.SCHEDULE_HOURS,
    questionType: QuestionType.SCALE_5,
    isReverse: false,
  },
  {
    order: 4,
    textJa: '忙しい時、チームで助け合えていますか？',
    textEn: 'Does your team help each other during busy times?',
    category: QuestionCategory.TEAMWORK,
    questionType: QuestionType.SCALE_5,
    isReverse: false,
  },
  {
    order: 5,
    textJa: '人手は十分だと感じますか？',
    textEn: 'Do you feel there is enough staff?',
    category: QuestionCategory.WORKLOAD_STAFFING,
    questionType: QuestionType.SCALE_5,
    isReverse: false,
  },
  {
    order: 6,
    textJa: '自分の頑張りは認められていると感じますか？',
    textEn: 'Do you feel your efforts are recognized?',
    category: QuestionCategory.RESPECT_RECOGNITION,
    questionType: QuestionType.SCALE_5,
    isReverse: false,
  },
  {
    order: 7,
    textJa: '今の給与・待遇に納得していますか？',
    textEn: 'Are you satisfied with your current pay and benefits?',
    category: QuestionCategory.PAY_BENEFITS,
    questionType: QuestionType.SCALE_5,
    isReverse: false,
  },
  {
    order: 8,
    textJa: '休憩は十分に取れていますか？',
    textEn: 'Are you able to take adequate breaks?',
    category: QuestionCategory.WORK_ENVIRONMENT,
    questionType: QuestionType.SCALE_5,
    isReverse: false,
  },
  {
    order: 9,
    textJa: '半年後もこの職場で働いていると思いますか？',
    textEn: 'Do you think you will still be working here in 6 months?',
    category: QuestionCategory.RETENTION_INTENT,
    questionType: QuestionType.SCALE_5,
    isReverse: false,
  },
  {
    order: 10,
    textJa: 'この職場を友人や知人に働く場所として勧めますか？',
    textEn: 'Would you recommend this workplace to friends or acquaintances?',
    category: QuestionCategory.ENPS,
    questionType: QuestionType.SCALE_11, // 0-10 scale
    isReverse: false,
  },
  {
    order: 11,
    textJa: 'この職場で改善してほしいことがあれば教えてください。',
    textEn: 'Please share any improvements you would like to see at this workplace.',
    category: QuestionCategory.FREE_TEXT,
    questionType: QuestionType.FREE_TEXT,
    isReverse: false,
  },
]

// Industry benchmarks for the 8 scoring categories
// Note: ENPS and FREE_TEXT don't have benchmarks in the same format
const benchmarks = [
  // RESTAURANT industry benchmarks
  { industry: Industry.RESTAURANT, category: QuestionCategory.MANAGER_LEADERSHIP, avgScore: 3.4, sampleSize: 1000 },
  { industry: Industry.RESTAURANT, category: QuestionCategory.SCHEDULE_HOURS, avgScore: 3.2, sampleSize: 1000 },
  { industry: Industry.RESTAURANT, category: QuestionCategory.TEAMWORK, avgScore: 3.5, sampleSize: 1000 },
  { industry: Industry.RESTAURANT, category: QuestionCategory.WORKLOAD_STAFFING, avgScore: 3.2, sampleSize: 1000 },
  { industry: Industry.RESTAURANT, category: QuestionCategory.RESPECT_RECOGNITION, avgScore: 3.3, sampleSize: 1000 },
  { industry: Industry.RESTAURANT, category: QuestionCategory.PAY_BENEFITS, avgScore: 3.0, sampleSize: 1000 },
  { industry: Industry.RESTAURANT, category: QuestionCategory.WORK_ENVIRONMENT, avgScore: 3.4, sampleSize: 1000 },
  { industry: Industry.RESTAURANT, category: QuestionCategory.RETENTION_INTENT, avgScore: 3.3, sampleSize: 1000 },

  // HOTEL industry benchmarks
  { industry: Industry.HOTEL, category: QuestionCategory.MANAGER_LEADERSHIP, avgScore: 3.5, sampleSize: 800 },
  { industry: Industry.HOTEL, category: QuestionCategory.SCHEDULE_HOURS, avgScore: 3.3, sampleSize: 800 },
  { industry: Industry.HOTEL, category: QuestionCategory.TEAMWORK, avgScore: 3.6, sampleSize: 800 },
  { industry: Industry.HOTEL, category: QuestionCategory.WORKLOAD_STAFFING, avgScore: 3.1, sampleSize: 800 },
  { industry: Industry.HOTEL, category: QuestionCategory.RESPECT_RECOGNITION, avgScore: 3.4, sampleSize: 800 },
  { industry: Industry.HOTEL, category: QuestionCategory.PAY_BENEFITS, avgScore: 3.2, sampleSize: 800 },
  { industry: Industry.HOTEL, category: QuestionCategory.WORK_ENVIRONMENT, avgScore: 3.5, sampleSize: 800 },
  { industry: Industry.HOTEL, category: QuestionCategory.RETENTION_INTENT, avgScore: 3.4, sampleSize: 800 },

  // RETAIL industry benchmarks
  { industry: Industry.RETAIL, category: QuestionCategory.MANAGER_LEADERSHIP, avgScore: 3.3, sampleSize: 1200 },
  { industry: Industry.RETAIL, category: QuestionCategory.SCHEDULE_HOURS, avgScore: 3.1, sampleSize: 1200 },
  { industry: Industry.RETAIL, category: QuestionCategory.TEAMWORK, avgScore: 3.4, sampleSize: 1200 },
  { industry: Industry.RETAIL, category: QuestionCategory.WORKLOAD_STAFFING, avgScore: 3.0, sampleSize: 1200 },
  { industry: Industry.RETAIL, category: QuestionCategory.RESPECT_RECOGNITION, avgScore: 3.2, sampleSize: 1200 },
  { industry: Industry.RETAIL, category: QuestionCategory.PAY_BENEFITS, avgScore: 2.9, sampleSize: 1200 },
  { industry: Industry.RETAIL, category: QuestionCategory.WORK_ENVIRONMENT, avgScore: 3.3, sampleSize: 1200 },
  { industry: Industry.RETAIL, category: QuestionCategory.RETENTION_INTENT, avgScore: 3.2, sampleSize: 1200 },

  // ENTERTAINMENT industry benchmarks
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.MANAGER_LEADERSHIP, avgScore: 3.6, sampleSize: 500 },
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.SCHEDULE_HOURS, avgScore: 3.4, sampleSize: 500 },
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.TEAMWORK, avgScore: 3.7, sampleSize: 500 },
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.WORKLOAD_STAFFING, avgScore: 3.3, sampleSize: 500 },
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.RESPECT_RECOGNITION, avgScore: 3.5, sampleSize: 500 },
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.PAY_BENEFITS, avgScore: 3.1, sampleSize: 500 },
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.WORK_ENVIRONMENT, avgScore: 3.6, sampleSize: 500 },
  { industry: Industry.ENTERTAINMENT, category: QuestionCategory.RETENTION_INTENT, avgScore: 3.5, sampleSize: 500 },

  // OTHER industry benchmarks
  { industry: Industry.OTHER, category: QuestionCategory.MANAGER_LEADERSHIP, avgScore: 3.4, sampleSize: 600 },
  { industry: Industry.OTHER, category: QuestionCategory.SCHEDULE_HOURS, avgScore: 3.2, sampleSize: 600 },
  { industry: Industry.OTHER, category: QuestionCategory.TEAMWORK, avgScore: 3.5, sampleSize: 600 },
  { industry: Industry.OTHER, category: QuestionCategory.WORKLOAD_STAFFING, avgScore: 3.1, sampleSize: 600 },
  { industry: Industry.OTHER, category: QuestionCategory.RESPECT_RECOGNITION, avgScore: 3.3, sampleSize: 600 },
  { industry: Industry.OTHER, category: QuestionCategory.PAY_BENEFITS, avgScore: 3.0, sampleSize: 600 },
  { industry: Industry.OTHER, category: QuestionCategory.WORK_ENVIRONMENT, avgScore: 3.4, sampleSize: 600 },
  { industry: Industry.OTHER, category: QuestionCategory.RETENTION_INTENT, avgScore: 3.3, sampleSize: 600 },
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

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
