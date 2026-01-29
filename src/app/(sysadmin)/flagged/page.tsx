import { prisma } from '@/lib/prisma'
import { FlaggedResponsesList } from './flagged-responses-list'

export const dynamic = 'force-dynamic'

export default async function FlaggedResponsesPage() {
  const flaggedResponses = await prisma.response.findMany({
    where: {
      flagged: true,
    },
    include: {
      shop: {
        include: {
          company: true,
        },
      },
    },
    orderBy: {
      submittedAt: 'desc',
    },
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Flagged Responses</h1>
        <p className="text-slate-500 mt-1">
          Responses flagged for concerning content requiring review
        </p>
      </div>

      <FlaggedResponsesList responses={flaggedResponses} />
    </div>
  )
}
