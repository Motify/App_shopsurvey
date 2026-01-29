'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Medal,
  Calendar,
  Building2,
  Users,
  Target,
  Award,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORY_LABELS, CategoryKey } from '@/lib/scoring'

interface RankingData {
  totalCompanies: number
  myRanking: {
    overall: {
      rank: number
      total: number
      percentile: number
      score: number | null
    }
    categories: Record<string, {
      rank: number
      total: number
      percentile: number
      score: number | null
    }>
    enps: {
      rank: number | null
      total: number
      percentile: number
      score: number | null
    }
    responseCount: number
  } | null
  benchmark: Record<string, number>
  industry: string
  industryName: string
  message?: string
}

// Date presets
const DATE_PRESETS = [
  { label: '全期間', value: 'all', days: 0 },
  { label: '過去30日', value: '30d', days: 30 },
  { label: '過去90日', value: '90d', days: 90 },
  { label: '過去6ヶ月', value: '6m', days: 180 },
  { label: '過去1年', value: '1y', days: 365 },
]

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getDateFromPreset(preset: string): { startDate: string | null; endDate: string | null } {
  if (preset === 'all') {
    return { startDate: null, endDate: null }
  }

  const endDate = new Date()
  const startDate = new Date()

  const presetConfig = DATE_PRESETS.find(p => p.value === preset)
  if (presetConfig && presetConfig.days > 0) {
    startDate.setDate(startDate.getDate() - presetConfig.days)
  }

  return {
    startDate: formatDateForInput(startDate),
    endDate: formatDateForInput(endDate),
  }
}

// Get percentile tier description
function getPercentileTier(percentile: number): { label: string; color: string; description: string } {
  if (percentile >= 90) {
    return { label: 'トップ10%', color: 'emerald', description: '業界トップクラスの成績です' }
  }
  if (percentile >= 75) {
    return { label: '上位25%', color: 'green', description: '業界平均を大きく上回っています' }
  }
  if (percentile >= 50) {
    return { label: '上位半分', color: 'blue', description: '業界平均以上の成績です' }
  }
  if (percentile >= 25) {
    return { label: '下位半分', color: 'yellow', description: '改善の余地があります' }
  }
  return { label: '下位25%', color: 'red', description: '早急な改善が必要です' }
}


// Ranking display component
function RankBadge({ rank, total }: { rank: number; total: number }) {
  const getMedalColor = () => {
    if (rank === 1) return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    if (rank === 2) return 'bg-slate-100 text-slate-600 border-slate-300'
    if (rank === 3) return 'bg-amber-100 text-amber-700 border-amber-300'
    return 'bg-slate-50 text-slate-600 border-slate-200'
  }

  const getMedalIcon = () => {
    if (rank <= 3) return <Medal className="h-4 w-4" />
    return <Trophy className="h-4 w-4" />
  }

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-medium',
      getMedalColor()
    )}>
      {getMedalIcon()}
      <span>{rank}位</span>
      <span className="text-xs opacity-70">/ {total}社</span>
    </div>
  )
}

// Percentile bar component
function PercentileBar({ percentile, showLabel = true }: { percentile: number; showLabel?: boolean }) {
  const tier = getPercentileTier(percentile)

  const getBarColor = () => {
    switch (tier.color) {
      case 'emerald': return 'bg-emerald-500'
      case 'green': return 'bg-green-500'
      case 'blue': return 'bg-blue-500'
      case 'yellow': return 'bg-yellow-500'
      case 'red': return 'bg-red-500'
      default: return 'bg-slate-500'
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        {showLabel && (
          <span className={cn(
            'text-sm font-medium',
            tier.color === 'emerald' && 'text-emerald-700',
            tier.color === 'green' && 'text-green-700',
            tier.color === 'blue' && 'text-blue-700',
            tier.color === 'yellow' && 'text-yellow-700',
            tier.color === 'red' && 'text-red-700',
          )}>
            {tier.label}
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          上位 {100 - percentile}%
        </span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', getBarColor())}
          style={{ width: `${percentile}%` }}
        />
      </div>
    </div>
  )
}

// Category ranking card
function CategoryRankingCard({
  category,
  ranking,
  benchmark,
}: {
  category: CategoryKey
  ranking: { rank: number; total: number; percentile: number; score: number | null }
  benchmark: number | null
}) {
  const label = CATEGORY_LABELS[category]
  const tier = getPercentileTier(ranking.percentile)

  const isAboveBenchmark = ranking.score !== null && benchmark !== null && ranking.score >= benchmark
  const benchmarkDiff = ranking.score !== null && benchmark !== null
    ? ranking.score - benchmark
    : null

  return (
    <div className="p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium text-sm">{label.ja}</p>
          <p className="text-xs text-muted-foreground">{label.en}</p>
        </div>
        <RankBadge rank={ranking.rank} total={ranking.total} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold">
            {ranking.score?.toFixed(2) ?? '-'}
          </span>
          {benchmarkDiff !== null && (
            <div className={cn(
              'flex items-center gap-1 text-sm',
              isAboveBenchmark ? 'text-green-600' : 'text-red-600'
            )}>
              {isAboveBenchmark ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <span>{Math.abs(benchmarkDiff).toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">vs 業界平均</span>
            </div>
          )}
        </div>

        <PercentileBar percentile={ranking.percentile} showLabel={false} />

        <p className={cn(
          'text-xs',
          tier.color === 'emerald' && 'text-emerald-600',
          tier.color === 'green' && 'text-green-600',
          tier.color === 'blue' && 'text-blue-600',
          tier.color === 'yellow' && 'text-yellow-600',
          tier.color === 'red' && 'text-red-600',
        )}>
          {tier.label}（上位{100 - ranking.percentile}%）
        </p>
      </div>
    </div>
  )
}

export default function CompanyRankingPage() {
  const [rankingData, setRankingData] = useState<RankingData | null>(null)
  const [loading, setLoading] = useState(true)

  // Date filtering
  const [datePreset, setDatePreset] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  useEffect(() => {
    fetchRanking()
  }, [customStartDate, customEndDate])

  const fetchRanking = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (customStartDate) params.set('startDate', customStartDate)
      if (customEndDate) params.set('endDate', customEndDate)

      const response = await fetch(`/api/reports/ranking?${params}`)
      if (response.ok) {
        const data = await response.json()
        setRankingData(data)
      }
    } catch (err) {
      console.error('Failed to fetch ranking:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset)
    const { startDate, endDate } = getDateFromPreset(preset)
    setCustomStartDate(startDate || '')
    setCustomEndDate(endDate || '')
  }

  // Get overall tier
  const overallTier = rankingData?.myRanking
    ? getPercentileTier(rankingData.myRanking.overall.percentile)
    : null

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-500" />
          企業ランキング
        </h1>
        <p className="text-muted-foreground">
          全企業の中でのあなたの会社の位置づけを確認できます
        </p>
      </div>

      {/* Date Filter */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            期間フィルター
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map(preset => (
              <Button
                key={preset.value}
                variant={datePreset === preset.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleDatePresetChange(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">開始日</Label>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value)
                  setDatePreset('custom')
                }}
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">終了日</Label>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value)
                  setDatePreset('custom')
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* No Data State */}
      {!loading && rankingData && !rankingData.myRanking && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {rankingData.message || 'まだ回答データがありません'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              回答が収集されるとランキングが表示されます
            </p>
          </CardContent>
        </Card>
      )}

      {/* Ranking Display */}
      {!loading && rankingData && rankingData.myRanking && (
        <div className="space-y-6">
          {/* Overall Ranking Hero Card */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    総合ランキング
                  </CardTitle>
                  <CardDescription>
                    {rankingData.industryName}業界
                    {' • '}
                    {rankingData.totalCompanies}社中
                    {' • '}
                    {rankingData.myRanking.responseCount}件の回答
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-sm px-3 py-1">
                  <Building2 className="h-3 w-3 mr-1" />
                  全{rankingData.totalCompanies}社
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Rank Display */}
                <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl shadow-sm">
                  <p className="text-sm text-muted-foreground mb-3">あなたの順位</p>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Trophy className={cn(
                        'h-16 w-16',
                        rankingData.myRanking.overall.rank === 1 && 'text-yellow-500',
                        rankingData.myRanking.overall.rank === 2 && 'text-slate-400',
                        rankingData.myRanking.overall.rank === 3 && 'text-amber-600',
                        rankingData.myRanking.overall.rank > 3 && 'text-primary/30',
                      )} />
                    </div>
                    <div className="text-center">
                      <span className="text-6xl font-bold text-primary">
                        {rankingData.myRanking.overall.rank}
                      </span>
                      <span className="text-2xl text-muted-foreground">位</span>
                      <p className="text-sm text-muted-foreground">
                        / {rankingData.myRanking.overall.total}社中
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 text-center">
                    <Badge className={cn(
                      'text-sm px-4 py-1',
                      overallTier?.color === 'emerald' && 'bg-emerald-100 text-emerald-700 border-emerald-200',
                      overallTier?.color === 'green' && 'bg-green-100 text-green-700 border-green-200',
                      overallTier?.color === 'blue' && 'bg-blue-100 text-blue-700 border-blue-200',
                      overallTier?.color === 'yellow' && 'bg-yellow-100 text-yellow-700 border-yellow-200',
                      overallTier?.color === 'red' && 'bg-red-100 text-red-700 border-red-200',
                    )}>
                      {overallTier?.label}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-2">
                      {overallTier?.description}
                    </p>
                  </div>
                </div>

                {/* Score and Percentile */}
                <div className="space-y-6">
                  <div className="p-4 bg-white rounded-xl shadow-sm">
                    <p className="text-sm text-muted-foreground mb-2">総合スコア</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">
                        {rankingData.myRanking.overall.score?.toFixed(2) ?? '-'}
                      </span>
                      <span className="text-muted-foreground">/ 5.00</span>
                    </div>
                    {rankingData.benchmark.overall && (
                      <div className={cn(
                        'flex items-center gap-1 mt-2 text-sm',
                        (rankingData.myRanking.overall.score ?? 0) >= rankingData.benchmark.overall
                          ? 'text-green-600'
                          : 'text-red-600'
                      )}>
                        {(rankingData.myRanking.overall.score ?? 0) >= rankingData.benchmark.overall ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        <span>
                          業界平均（{rankingData.benchmark.overall.toFixed(2)}）より
                          {Math.abs((rankingData.myRanking.overall.score ?? 0) - rankingData.benchmark.overall).toFixed(2)}
                          {(rankingData.myRanking.overall.score ?? 0) >= rankingData.benchmark.overall ? '高い' : '低い'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-white rounded-xl shadow-sm">
                    <p className="text-sm text-muted-foreground mb-3">パーセンタイル</p>
                    <PercentileBar percentile={rankingData.myRanking.overall.percentile} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* eNPS Ranking */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                eNPSランキング
              </CardTitle>
              <CardDescription>従業員推奨度による順位</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="text-center p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-muted-foreground mb-2">順位</p>
                  {rankingData.myRanking.enps.rank ? (
                    <RankBadge
                      rank={rankingData.myRanking.enps.rank}
                      total={rankingData.myRanking.enps.total}
                    />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-muted-foreground mb-2">eNPSスコア</p>
                  <span className={cn(
                    'text-3xl font-bold',
                    rankingData.myRanking.enps.score === null ? 'text-slate-400' :
                    (rankingData.myRanking.enps.score ?? 0) >= 30 ? 'text-emerald-600' :
                    (rankingData.myRanking.enps.score ?? 0) >= 0 ? 'text-green-600' :
                    (rankingData.myRanking.enps.score ?? 0) >= -30 ? 'text-yellow-600' : 'text-red-600'
                  )}>
                    {rankingData.myRanking.enps.score !== null
                      ? (rankingData.myRanking.enps.score >= 0 ? '+' : '') + rankingData.myRanking.enps.score
                      : '-'}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-muted-foreground mb-2">パーセンタイル</p>
                  {rankingData.myRanking.enps.rank ? (
                    <PercentileBar percentile={rankingData.myRanking.enps.percentile} showLabel={false} />
                  ) : (
                    <span className="text-muted-foreground text-sm">データなし</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category Rankings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                カテゴリ別ランキング
              </CardTitle>
              <CardDescription>8つの評価カテゴリごとの順位</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(rankingData.myRanking.categories)
                  .filter(([key]) => key !== 'ENPS' && key !== 'FREE_TEXT' && key !== 'RETENTION_INTENTION')
                  .map(([category, ranking]) => (
                    <CategoryRankingCard
                      key={category}
                      category={category as CategoryKey}
                      ranking={ranking}
                      benchmark={rankingData.benchmark[category] ?? null}
                    />
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-slate-500 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-700">
                    プライバシー保護について
                  </p>
                  <p className="text-sm text-slate-600">
                    ランキングには{rankingData.totalCompanies}社のデータが含まれていますが、
                    他社の名前や詳細情報は表示されません。
                    あなたの会社の相対的な位置のみを確認できます。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
