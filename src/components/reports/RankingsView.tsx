'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ShopReport {
  shop: {
    id: string
    name: string
  }
  scores: {
    overall: number | null
    categories: Record<string, number | null>
  }
  responseCount: number
}

interface RankingsViewProps {
  rankings: {
    overall: ShopReport[]
    byCategory: Record<string, ShopReport[]>
  }
}

const CATEGORY_OPTIONS = [
  { value: 'overall', label: '総合スコア' },
  { value: 'MANAGER_LEADERSHIP', label: '店長・リーダー' },
  { value: 'SCHEDULE_HOURS', label: 'シフト・時間' },
  { value: 'TEAMWORK', label: 'チームワーク' },
  { value: 'WORKLOAD_STAFFING', label: '忙しさ・負担' },
  { value: 'RESPECT_RECOGNITION', label: '尊重・承認' },
  { value: 'PAY_BENEFITS', label: '給与・待遇' },
  { value: 'WORK_ENVIRONMENT', label: '職場環境' },
  { value: 'SKILLS_GROWTH', label: 'スキル・成長' },
]

function getRiskBadge(score: number | null) {
  if (score === null) return null

  if (score >= 4.0) {
    return <Badge className="bg-emerald-100 text-emerald-700">優秀</Badge>
  } else if (score >= 3.5) {
    return <Badge className="bg-green-100 text-green-700">安定</Badge>
  } else if (score >= 3.0) {
    return <Badge className="bg-yellow-100 text-yellow-700">注意</Badge>
  } else if (score >= 2.5) {
    return <Badge className="bg-orange-100 text-orange-700">警告</Badge>
  } else {
    return <Badge className="bg-red-100 text-red-700">危険</Badge>
  }
}

function getMedalEmoji(rank: number): string {
  if (rank === 0) return '🥇'
  if (rank === 1) return '🥈'
  if (rank === 2) return '🥉'
  return `${rank + 1}.`
}

export function RankingsView({ rankings }: RankingsViewProps) {
  const [category, setCategory] = useState('overall')

  const data = category === 'overall'
    ? rankings.overall
    : rankings.byCategory[category] || []

  const getScore = (item: ShopReport): number | null => {
    if (category === 'overall') {
      return item.scores.overall
    }
    return item.scores.categories[category] ?? null
  }

  return (
    <div>
      {/* Category selector */}
      <div className="mb-4">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Ranking list */}
      {data.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          ランキングデータがありません
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((item, i) => {
            const score = getScore(item)
            return (
              <div
                key={item.shop.id}
                className={cn(
                  'flex items-center p-4 border rounded-lg',
                  i === 0 && 'bg-amber-50 border-amber-200',
                  i === 1 && 'bg-slate-50 border-slate-200',
                  i === 2 && 'bg-orange-50 border-orange-200'
                )}
              >
                <span className="text-2xl font-bold w-12 text-center">
                  {getMedalEmoji(i)}
                </span>
                <div className="flex-1 ml-2">
                  <span className="font-medium">{item.shop.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({item.responseCount}件)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-bold">
                    {score?.toFixed(2) ?? '-'}
                  </span>
                  {getRiskBadge(score)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
