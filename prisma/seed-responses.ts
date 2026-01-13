import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Realistic Japanese comments categorized by sentiment
const positiveComments = [
  '店長がいつも親切で、働きやすい環境です。',
  'チームワークが良く、忙しい時も助け合えています。',
  'シフトの希望を聞いてくれるので、学校との両立ができています。',
  '先輩スタッフが優しく教えてくれるので、安心して働けます。',
  '職場の雰囲気が明るくて、毎日楽しく働いています。',
  '店長が公平に評価してくれるので、やりがいを感じます。',
  '休憩もしっかり取れて、無理なく働けています。',
  '同僚との関係が良好で、仕事が楽しいです。',
  'マネージャーが相談しやすい人で助かっています。',
  '研修制度がしっかりしていて、成長を感じられます。',
  '働きやすい職場だと思います。特に不満はありません。',
  'スタッフ同士の仲が良く、協力し合える環境です。',
  '店長のリーダーシップが素晴らしいと思います。',
  'お客様からの「ありがとう」が励みになっています。',
  '柔軟なシフト対応に感謝しています。',
]

const neutralComments = [
  '特に問題はありませんが、給与がもう少し上がると嬉しいです。',
  '普通に働けていますが、繁忙期は少し大変です。',
  '可もなく不可もなくといった感じです。',
  '仕事内容には満足していますが、通勤が少し遠いです。',
  '概ね満足していますが、人手が増えると助かります。',
  '特にコメントはありません。',
  '良い点も改善点もありますが、総合的には満足です。',
  'もう少し時給が上がるといいなと思います。',
  '忙しい日とそうでない日の差が激しいです。',
  '休憩室がもう少し広いといいなと思います。',
]

const negativeComments = [
  '人手不足で毎日忙しすぎます。もっとスタッフを増やしてほしい。',
  '店長が特定のスタッフばかり優遇していて不公平に感じます。',
  '休憩時間が短く、十分に休めていません。',
  'シフトの希望が通らないことが多く、困っています。',
  '給与が仕事量に見合っていないと感じます。',
  '先輩スタッフの態度が厳しすぎて、質問しづらいです。',
  '残業が多く、プライベートの時間が取れません。',
  'マネージャーに相談しても、あまり対応してもらえません。',
  '人間関係のトラブルがあり、職場に行くのが憂鬱です。',
  'エアコンの効きが悪く、夏は特に辛いです。',
  '忙しい時に助けてくれる人がいなくて大変です。',
  '評価基準が不明確で、頑張りが認められていない気がします。',
  '新人への教育体制が整っていないと思います。',
  'クレーム対応を一人で任されることが多く、ストレスを感じます。',
  '連勤が続くことがあり、体力的にきついです。',
]

const specificComments = {
  restaurant: [
    'キッチンとホールの連携をもっと改善してほしいです。',
    'ピーク時の忙しさが半端ないです。人を増やしてほしい。',
    '立ち仕事が多いので、足が疲れます。',
    '料理の提供スピードについて、もっとトレーニングが必要だと思います。',
    'お客様対応のマニュアルがもう少し充実しているといいです。',
  ],
  karaoke: [
    '深夜シフトの時、一人で対応するのが不安です。',
    '酔っ払いのお客様の対応が大変です。',
    '機械トラブルの対応方法をもっと教えてほしいです。',
    '清掃の時間がもう少し欲しいです。',
    'ドリンク作りと受付を同時にするのが大変です。',
  ],
  hotel: [
    'チェックイン・チェックアウト時の混雑対応が大変です。',
    '外国人のお客様への対応研修があるといいです。',
    'クレーム対応のサポート体制を強化してほしいです。',
    '部屋の清掃時間が短すぎると感じます。',
    '夜勤明けの体調管理が難しいです。',
  ],
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Generate scores based on sentiment profile
function generateScores(sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'): Record<string, number> {
  const baseScores = {
    positive: { min: 3, max: 5, enpsMin: 7, enpsMax: 10 },
    neutral: { min: 2, max: 4, enpsMin: 5, enpsMax: 7 },
    negative: { min: 1, max: 3, enpsMin: 0, enpsMax: 5 },
    mixed: { min: 2, max: 5, enpsMin: 3, enpsMax: 8 },
  }

  const base = baseScores[sentiment]

  return {
    q1: randomInt(base.min, base.max), // Manager consultation
    q2: randomInt(base.min, base.max), // Fair treatment
    q3: randomInt(base.min, base.max), // Shift preferences
    q4: randomInt(base.min, base.max), // Teamwork
    q5: randomInt(base.min, base.max), // Staffing
    q6: randomInt(base.min, base.max), // Recognition
    q7: randomInt(Math.max(1, base.min - 1), base.max), // Pay (usually slightly lower)
    q8: randomInt(base.min, base.max), // Breaks
    q9: randomInt(base.min, base.max), // Retention intent
    q10: randomInt(base.enpsMin, base.enpsMax), // eNPS 0-10
  }
}

function getComment(shopName: string, sentiment: 'positive' | 'neutral' | 'negative'): string | null {
  // 30% chance of no comment
  if (Math.random() < 0.3) return null

  let comments: string[] = []

  if (sentiment === 'positive') {
    comments = [...positiveComments]
  } else if (sentiment === 'neutral') {
    comments = [...neutralComments]
  } else {
    comments = [...negativeComments]
  }

  // Add specific comments based on shop type
  if (shopName.includes('レストラン')) {
    comments = [...comments, ...specificComments.restaurant]
  } else if (shopName.includes('カラオケ')) {
    comments = [...comments, ...specificComments.karaoke]
  } else if (shopName.includes('ホテル')) {
    comments = [...comments, ...specificComments.hotel]
  }

  return randomChoice(comments)
}

function randomDate(daysBack: number): Date {
  const now = new Date()
  const randomDays = Math.floor(Math.random() * daysBack)
  const randomHours = Math.floor(Math.random() * 24)
  const randomMinutes = Math.floor(Math.random() * 60)

  return new Date(
    now.getTime() - (randomDays * 24 * 60 * 60 * 1000) - (randomHours * 60 * 60 * 1000) - (randomMinutes * 60 * 1000)
  )
}

async function main() {
  console.log('Generating survey responses for iikaisha株式会社...\n')

  // Get the company
  const company = await prisma.company.findFirst({
    where: { name: 'iikaisha株式会社' },
  })

  if (!company) {
    console.error('Company not found! Run seed-demo.ts first.')
    process.exit(1)
  }

  // Get all child shops (not area parents)
  const shops = await prisma.shop.findMany({
    where: {
      companyId: company.id,
      parentId: { not: null }, // Only child shops
    },
  })

  console.log(`Found ${shops.length} shops to generate responses for.\n`)

  let totalResponses = 0

  for (const shop of shops) {
    const numResponses = randomInt(20, 30)
    console.log(`Generating ${numResponses} responses for ${shop.name}...`)

    for (let i = 0; i < numResponses; i++) {
      // Randomly assign sentiment with distribution:
      // 40% positive, 30% neutral, 20% negative, 10% mixed
      const rand = Math.random()
      let sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
      if (rand < 0.4) sentiment = 'positive'
      else if (rand < 0.7) sentiment = 'neutral'
      else if (rand < 0.9) sentiment = 'negative'
      else sentiment = 'mixed'

      const scores = generateScores(sentiment)
      const commentSentiment = sentiment === 'mixed' ? randomChoice(['positive', 'neutral', 'negative'] as const) : sentiment
      const comment = getComment(shop.name, commentSentiment)

      await prisma.response.create({
        data: {
          shopId: shop.id,
          answers: scores,
          comment: comment,
          submittedAt: randomDate(90), // Random date within last 90 days
        },
      })
    }

    totalResponses += numResponses
  }

  console.log(`\n✓ Generated ${totalResponses} survey responses across ${shops.length} shops!`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
