'use client'

import { cn } from '@/lib/utils'
import { Trophy, TrendingDown, AlertTriangle } from 'lucide-react'

interface ShopReport {
  shop: {
    id: string
    name: string
  }
  scores: {
    overall: number | null
    categories: Record<string, number | null>
    enps: number | null
  }
  responseCount: number
}

interface ComparisonTableProps {
  shops: ShopReport[]
  benchmark: Record<string, number>
}

const CATEGORY_LABELS: Record<string, string> = {
  MANAGER_LEADERSHIP: '店長・リーダー',
  SCHEDULE_HOURS: 'シフト・時間',
  TEAMWORK: 'チームワーク',
  WORKLOAD_STAFFING: '忙しさ・負担',
  RESPECT_RECOGNITION: '尊重・承認',
  PAY_BENEFITS: '給与・待遇',
  WORK_ENVIRONMENT: '職場環境',
  SKILLS_GROWTH: 'スキル・成長',
}

export function ComparisonTable({ shops, benchmark }: ComparisonTableProps) {
  const categories = Object.entries(CATEGORY_LABELS)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50">
            <th className="text-left p-3 font-medium">カテゴリ</th>
            {shops.map((s) => (
              <th key={s.shop.id} className="text-center p-3 font-medium min-w-[100px]">
                <div>{s.shop.name}</div>
                <div className="text-xs font-normal text-muted-foreground">
                  ({s.responseCount}件)
                </div>
              </th>
            ))}
            <th className="text-center p-3 font-medium text-slate-500 min-w-[80px]">
              業界平均
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map(([key, label]) => {
            const scores = shops.map((s) => s.scores.categories[key])
            const validScores = scores.filter((s): s is number => s !== null)
            const maxScore = validScores.length > 0 ? Math.max(...validScores) : null
            const minScore = validScores.length > 0 ? Math.min(...validScores) : null

            return (
              <tr key={key} className="border-b hover:bg-slate-50">
                <td className="p-3 font-medium">{label}</td>
                {shops.map((s, i) => {
                  const score = s.scores.categories[key]
                  const isMax = score !== null && score === maxScore && validScores.length > 1
                  const isMin = score !== null && score === minScore && validScores.length > 1 && maxScore !== minScore

                  return (
                    <td
                      key={s.shop.id}
                      className={cn(
                        'text-center p-3',
                        isMax && 'bg-green-50 text-green-700 font-bold',
                        isMin && 'bg-red-50 text-red-700'
                      )}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {score !== null ? score.toFixed(2) : '-'}
                        {isMax && <Trophy className="h-4 w-4 text-green-600" />}
                        {isMin && <TrendingDown className="h-4 w-4 text-red-500" />}
                      </div>
                    </td>
                  )
                })}
                <td className="text-center p-3 text-slate-500">
                  {benchmark[key]?.toFixed(2) ?? '-'}
                </td>
              </tr>
            )
          })}
          {/* eNPS Row */}
          <tr className="border-b hover:bg-slate-50">
            <td className="p-3 font-medium">eNPS</td>
            {shops.map((s) => {
              const enps = s.scores.enps
              return (
                <td key={s.shop.id} className="text-center p-3">
                  {enps !== null ? (enps >= 0 ? `+${enps}` : enps) : '-'}
                </td>
              )
            })}
            <td className="text-center p-3 text-slate-500">-</td>
          </tr>
          {/* Overall Row */}
          <tr className="border-t-2 bg-slate-50 font-bold">
            <td className="p-3">総合スコア</td>
            {shops.map((s) => {
              const overall = s.scores.overall
              const validOveralls = shops.map((sh) => sh.scores.overall).filter((o): o is number => o !== null)
              const isMax = overall !== null && overall === Math.max(...validOveralls) && validOveralls.length > 1
              const isMin = overall !== null && overall === Math.min(...validOveralls) && validOveralls.length > 1

              return (
                <td
                  key={s.shop.id}
                  className={cn(
                    'text-center p-3',
                    isMax && 'text-green-700',
                    isMin && 'text-red-700'
                  )}
                >
                  <div className="flex items-center justify-center gap-1">
                    {overall?.toFixed(2) ?? '-'}
                    {isMax && <Trophy className="h-4 w-4 text-green-600" />}
                  </div>
                </td>
              )
            })}
            <td className="text-center p-3 text-slate-500">
              {benchmark.overall?.toFixed(2) ?? '-'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

interface GapAnalysis {
  category: string
  categoryKey: string
  best: { shop: string; score: number }
  worst: { shop: string; score: number }
  gap: number
}

interface GapInsightsProps {
  gaps: GapAnalysis[]
}

export function GapInsights({ gaps }: GapInsightsProps) {
  if (gaps.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        比較データが不足しています
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-bold flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        店舗間の差が大きい領域
      </h3>

      {gaps.slice(0, 3).map((gap, i) => (
        <div key={gap.categoryKey} className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="font-medium">
              {i + 1}. {gap.category}
            </span>
            <span className="text-sm text-muted-foreground">
              差: {gap.gap.toFixed(1)}ポイント
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <Trophy className="h-4 w-4" />
                <span className="font-medium">最高</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-sm">{gap.best.shop}</span>
                <span className="font-bold">{gap.best.score.toFixed(1)}</span>
              </div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <TrendingDown className="h-4 w-4" />
                <span className="font-medium">最低</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-sm">{gap.worst.shop}</span>
                <span className="font-bold">{gap.worst.score.toFixed(1)}</span>
              </div>
            </div>
          </div>

          <p className="mt-3 text-sm text-slate-600 bg-blue-50 p-2 rounded">
            {gap.best.shop}の{gap.category}への取り組みを{gap.worst.shop}に展開することで改善が期待できます
          </p>
        </div>
      ))}
    </div>
  )
}
