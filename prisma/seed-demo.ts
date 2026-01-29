import { PrismaClient } from '@prisma/client'
import { nanoid } from 'nanoid'

const prisma = new PrismaClient()

async function main() {
  console.log('Creating demo company: iikaisha株式会社')

  // Get the ENTERTAINMENT industry
  const entertainmentIndustry = await prisma.industryType.findUnique({
    where: { code: 'ENTERTAINMENT' },
  })

  if (!entertainmentIndustry) {
    console.error('ENTERTAINMENT industry not found. Run seed first.')
    process.exit(1)
  }

  // Create the company (using ENTERTAINMENT for mixed business)
  const company = await prisma.company.create({
    data: {
      name: 'iikaisha株式会社',
      industryId: entertainmentIndustry.id,
      status: 'ACTIVE',
    },
  })
  console.log(`Created company: ${company.name} (${company.id})`)

  // Define 5 areas in Japan
  const areas = [
    { name: '東京エリア', shops: [
      { name: '渋谷レストラン', shopNumber: 'TKY-001' },
      { name: '新宿レストラン', shopNumber: 'TKY-002' },
      { name: '池袋レストラン', shopNumber: 'TKY-003' },
      { name: '渋谷カラオケ', shopNumber: 'TKY-004' },
      { name: '新宿カラオケ', shopNumber: 'TKY-005' },
    ]},
    { name: '大阪エリア', shops: [
      { name: '梅田レストラン', shopNumber: 'OSK-001' },
      { name: '難波レストラン', shopNumber: 'OSK-002' },
      { name: '心斎橋カラオケ', shopNumber: 'OSK-003' },
      { name: '梅田カラオケ', shopNumber: 'OSK-004' },
    ]},
    { name: '名古屋エリア', shops: [
      { name: '栄レストラン', shopNumber: 'NGY-001' },
      { name: '名駅レストラン', shopNumber: 'NGY-002' },
      { name: '栄カラオケ', shopNumber: 'NGY-003' },
      { name: '名古屋グランドホテル', shopNumber: 'NGY-H01' },
    ]},
    { name: '福岡エリア', shops: [
      { name: '天神レストラン', shopNumber: 'FUK-001' },
      { name: '博多レストラン', shopNumber: 'FUK-002' },
      { name: '天神カラオケ', shopNumber: 'FUK-003' },
      { name: '博多カラオケ', shopNumber: 'FUK-004' },
    ]},
    { name: '札幌エリア', shops: [
      { name: 'すすきのレストラン', shopNumber: 'SPR-001' },
      { name: '札幌駅前レストラン', shopNumber: 'SPR-002' },
      { name: 'すすきのカラオケ', shopNumber: 'SPR-003' },
    ]},
  ]

  // Create areas as parent shops, then child shops under each
  for (const area of areas) {
    const parentShop = await prisma.shop.create({
      data: {
        companyId: company.id,
        name: area.name,
        qrCode: nanoid(10),
        status: 'ACTIVE',
      },
    })
    console.log(`Created area: ${parentShop.name}`)

    for (const shop of area.shops) {
      const childShop = await prisma.shop.create({
        data: {
          companyId: company.id,
          parentId: parentShop.id,
          name: shop.name,
          shopNumber: shop.shopNumber,
          qrCode: nanoid(10),
          status: 'ACTIVE',
        },
      })
      console.log(`  - Created shop: ${childShop.name} (${childShop.shopNumber})`)
    }
  }

  console.log('\nDemo company setup complete!')
  console.log(`Total: 5 areas + 20 shops = 25 shop records`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
