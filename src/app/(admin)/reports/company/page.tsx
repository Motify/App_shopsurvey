'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScoreRadarChart } from '@/components/charts/ScoreRadarChart'
import {
  Loader2,
  Store,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CategoryKey, CATEGORY_LABELS } from '@/lib/scoring'

interface DashboardData {
  summary: {
    totalShops: number
    activeShops: number
    totalResponses: number
    overallScore: number | null
    overallRisk: { level: string; label: string; color: string } | null
    benchmarkOverall: number | null
  }
  categoryScores: Record<CategoryKey, number | null>
  benchmarks: Record<string, number>
  riskCounts: {
    CRITICAL: number
    WARNING: number
    CAUTION: number
    STABLE: number
    EXCELLENT: number
    NO_DATA: number
  }
  lowestScoringShops: Array<{
    id: string
    name: string
    responseCount: number
    overallScore: number | null
    risk: { level: string; label: string; color: string } | null
  }>
  highestScoringShops: Array<{
    id: string
    name: string
    responseCount: number
    overallScore: number | null
    risk: { level: string; label: string; color: string } | null
  }>
  company: {
    name: string
    industry: string
  }
}

export default function CompanyReportsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    try {
      const response = await fetch('/api/reports/dashboard')
      if (!response.ok) {
        if (response.status === 403) {
          setError('このページにアクセスする権限がありません')
        } else {
          setError('データの取得に失敗しました')
        }
        return
      }
      const dashboardData = await response.json()
      setData(dashboardData)
    } catch (err) {
      console.error('Failed to fetch dashboard:', err)
      setError('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const getRiskBadgeClass = (level: string) => {
    switch (level) {
      case 'CRITICAL':
      case 'NEEDS_IMPROVEMENT':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'WARNING':
      case 'ROOM_FOR_IMPROVEMENT':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'CAUTION':
        return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'STABLE':
      case 'GOOD':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'EXCELLENT':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  // Prepare radar chart data
  const radarData = (Object.keys(CATEGORY_LABELS) as CategoryKey[]).map(category => ({
    category,
    score: data.categoryScores[category],
    benchmark: data.benchmarks[category] ?? null,
  }))

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
          <Link href="/reports" className="hover:text-primary">
            レポート
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span>全社レポート</span>
        </div>
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-slate-600" />
          <div>
            <h1 className="text-2xl font-bold">{data.company.name}</h1>
            <p className="text-muted-foreground">全社レポート</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">店舗数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalShops}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">総回答数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalResponses}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">全社スコア</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {data.summary.overallScore?.toFixed(2) ?? '-'}
              </span>
              {data.summary.overallRisk && (
                <Badge className={cn('text-xs', getRiskBadgeClass(data.summary.overallRisk.level))}>
                  {data.summary.overallRisk.label}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">要注意店舗</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {data.riskCounts.CRITICAL + data.riskCounts.WARNING}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">全社カテゴリスコア</CardTitle>
            <CardDescription>業界平均との比較</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreRadarChart
              data={radarData}
              shopName="全社平均"
              height={320}
            />
            {data.summary.overallScore !== null && data.summary.benchmarkOverall !== null && (
              <div className="mt-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  {data.summary.overallScore >= data.summary.benchmarkOverall ? (
                    <ArrowUpRight className="h-5 w-5 text-green-500" />
                  ) : (
                    <ArrowDownRight className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-sm">
                    業界平均より{' '}
                    <span
                      className={cn(
                        'font-bold',
                        data.summary.overallScore >= data.summary.benchmarkOverall
                          ? 'text-green-600'
                          : 'text-red-600'
                      )}
                    >
                      {Math.abs(data.summary.overallScore - data.summary.benchmarkOverall).toFixed(1)}
                    </span>
                    {' '}ポイント
                    {data.summary.overallScore >= data.summary.benchmarkOverall ? '高い' : '低い'}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">リスクレベル分布</CardTitle>
            <CardDescription>店舗のリスク状態</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="font-medium">危険</span>
                </div>
                <span className="text-2xl font-bold text-red-600">
                  {data.riskCounts.CRITICAL}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-100">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="font-medium">注意</span>
                </div>
                <span className="text-2xl font-bold text-orange-600">
                  {data.riskCounts.WARNING}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-100">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="font-medium">やや注意</span>
                </div>
                <span className="text-2xl font-bold text-yellow-600">
                  {data.riskCounts.CAUTION}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-100">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="font-medium">安定 / 優良</span>
                </div>
                <span className="text-2xl font-bold text-green-600">
                  {data.riskCounts.STABLE + data.riskCounts.EXCELLENT}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-slate-400" />
                  <span className="font-medium">データなし</span>
                </div>
                <span className="text-2xl font-bold text-slate-600">
                  {data.riskCounts.NO_DATA}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shop Rankings */}
      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        {/* Lowest Scoring Shops */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              低スコア店舗
            </CardTitle>
            <CardDescription>改善が必要な店舗</CardDescription>
          </CardHeader>
          <CardContent>
            {data.lowestScoringShops.length > 0 ? (
              <div className="space-y-3">
                {data.lowestScoringShops.map((shop, index) => (
                  <Link
                    key={shop.id}
                    href={`/reports?shop=${shop.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-slate-400 w-6">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-sm">{shop.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {shop.responseCount} 回答
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">
                        {shop.overallScore?.toFixed(2) ?? '-'}
                      </span>
                      {shop.risk && (
                        <Badge className={cn('text-xs', getRiskBadgeClass(shop.risk.level))}>
                          {shop.risk.label}
                        </Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                データがありません
              </p>
            )}
          </CardContent>
        </Card>

        {/* Highest Scoring Shops */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              高スコア店舗
            </CardTitle>
            <CardDescription>優良店舗</CardDescription>
          </CardHeader>
          <CardContent>
            {data.highestScoringShops.length > 0 ? (
              <div className="space-y-3">
                {data.highestScoringShops.map((shop, index) => (
                  <Link
                    key={shop.id}
                    href={`/reports?shop=${shop.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-slate-400 w-6">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-sm">{shop.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {shop.responseCount} 回答
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">
                        {shop.overallScore?.toFixed(2) ?? '-'}
                      </span>
                      {shop.risk && (
                        <Badge className={cn('text-xs', getRiskBadgeClass(shop.risk.level))}>
                          {shop.risk.label}
                        </Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                データがありません
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
