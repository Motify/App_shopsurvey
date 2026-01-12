'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ScoreRadarChart } from '@/components/charts/ScoreRadarChart'
import {
  Loader2,
  Store,
  AlertTriangle,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare,
  Users,
  ThumbsUp,
  ThumbsDown,
  Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORY_LABELS, CategoryKey, REVERSE_SCORED_CATEGORIES } from '@/lib/scoring'

interface Shop {
  id: string
  name: string
  parentId: string | null
}

interface CategoryBreakdown {
  category: CategoryKey
  label: { ja: string; en: string }
  score: number | null
  benchmark: number | null
  difference: number | null
  risk: { level: string; label: string; color: string } | null
  isReverse?: boolean
}

interface ENPSData {
  score: number | null
  risk: { level: string; label: string; color: string }
  promoters: number
  passives: number
  detractors: number
  totalResponses: number
  promoterPercentage: number | null
  detractorPercentage: number | null
}

interface Comment {
  text: string
  submittedAt: string
}

interface ReportData {
  shop: {
    id: string
    name: string
    companyName: string
    industry: string
  }
  includesChildren: boolean
  shopCount: number
  responseCount: number
  overallScore: number | null
  overallRisk: { level: string; label: string; color: string } | null
  benchmarkOverall: number | null
  categoryBreakdown: CategoryBreakdown[]
  confidence: { level: string; label: string; description: string }
  enps: ENPSData
  comments: {
    total: number
    recent: Comment[]
  }
}

export default function ReportsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialShopId = searchParams.get('shop') || ''

  const [shops, setShops] = useState<Shop[]>([])
  const [selectedShopId, setSelectedShopId] = useState(initialShopId)
  const [includeChildren, setIncludeChildren] = useState(true)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [shopsLoading, setShopsLoading] = useState(true)

  // Fetch shops on mount
  useEffect(() => {
    fetchShops()
  }, [])

  // Fetch report when shop changes
  useEffect(() => {
    if (selectedShopId) {
      fetchReport()
    } else {
      setReportData(null)
    }
  }, [selectedShopId, includeChildren])

  const fetchShops = async () => {
    try {
      const response = await fetch('/api/shops')
      if (response.ok) {
        const data = await response.json()
        setShops(data)
        // Auto-select first shop if no selection and shops exist
        if (!selectedShopId && data.length > 0) {
          setSelectedShopId(data[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to fetch shops:', err)
    } finally {
      setShopsLoading(false)
    }
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/reports/shop/${selectedShopId}?includeChildren=${includeChildren}`
      )
      if (response.ok) {
        const data = await response.json()
        setReportData(data)
      }
    } catch (err) {
      console.error('Failed to fetch report:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleShopChange = (shopId: string) => {
    setSelectedShopId(shopId)
    router.push(`/reports?shop=${shopId}`)
  }

  // Build hierarchical shop display name
  const getShopDisplayName = (shop: Shop): string => {
    const parts: string[] = [shop.name]
    let current = shop
    while (current.parentId) {
      const parent = shops.find(s => s.id === current.parentId)
      if (parent) {
        parts.unshift(parent.name)
        current = parent
      } else {
        break
      }
    }
    return parts.join(' > ')
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

  const formatENPS = (score: number | null): string => {
    if (score === null) return '-'
    return score >= 0 ? `+${score}` : `${score}`
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">レポート</h1>
        <p className="text-muted-foreground">店舗ごとの詳細スコアと分析</p>
      </div>

      {/* Shop Selection */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">店舗選択</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select
                value={selectedShopId}
                onValueChange={handleShopChange}
                disabled={shopsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="店舗を選択..." />
                </SelectTrigger>
                <SelectContent>
                  {shops.map(shop => (
                    <SelectItem key={shop.id} value={shop.id}>
                      {getShopDisplayName(shop)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="includeChildren"
                checked={includeChildren}
                onCheckedChange={(checked) => setIncludeChildren(checked === true)}
              />
              <label
                htmlFor="includeChildren"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                子店舗を含める
              </label>
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

      {/* No Selection State */}
      {!loading && !selectedShopId && (
        <Card>
          <CardContent className="py-12 text-center">
            <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">店舗を選択してレポートを表示</p>
          </CardContent>
        </Card>
      )}

      {/* Report Display */}
      {!loading && reportData && (
        <div className="space-y-6">
          {/* Overall Score Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{reportData.shop.name}</CardTitle>
                  <CardDescription>
                    {reportData.includesChildren && reportData.shopCount > 1
                      ? `${reportData.shopCount} 店舗の集計`
                      : '単一店舗'}
                    {' • '}
                    {reportData.responseCount} 件の回答
                  </CardDescription>
                </div>
                {reportData.confidence.level === 'LOW' && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {reportData.confidence.label}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Score Display */}
                <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl">
                  <p className="text-sm text-muted-foreground mb-2">総合スコア</p>
                  <div className="flex items-center gap-3">
                    <span className="text-5xl font-bold">
                      {reportData.overallScore?.toFixed(2) ?? '-'}
                    </span>
                    {reportData.overallRisk && (
                      <Badge
                        className={cn(
                          'text-sm px-3 py-1',
                          getRiskBadgeClass(reportData.overallRisk.level)
                        )}
                      >
                        {reportData.overallRisk.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">5点満点</p>

                  {/* Benchmark Comparison */}
                  {reportData.overallScore !== null && reportData.benchmarkOverall !== null && (
                    <div className="mt-4 flex items-center gap-2">
                      {reportData.overallScore >= reportData.benchmarkOverall ? (
                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm">
                        業界平均より{' '}
                        <span
                          className={cn(
                            'font-bold',
                            reportData.overallScore >= reportData.benchmarkOverall
                              ? 'text-green-600'
                              : 'text-red-600'
                          )}
                        >
                          {Math.abs(reportData.overallScore - reportData.benchmarkOverall).toFixed(1)}
                        </span>
                        {' '}ポイント
                        {reportData.overallScore >= reportData.benchmarkOverall ? '高い' : '低い'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Radar Chart */}
                <div>
                  <ScoreRadarChart
                    data={reportData.categoryBreakdown.map(c => ({
                      category: c.category,
                      score: c.score,
                      benchmark: c.benchmark,
                    }))}
                    shopName={reportData.shop.name}
                    height={280}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* eNPS Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                eNPS (従業員推奨度)
              </CardTitle>
              <CardDescription>
                「この職場を友人に勧めますか？」への回答分析
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {/* eNPS Score */}
                <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl">
                  <p className="text-sm text-muted-foreground mb-2">eNPSスコア</p>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'text-5xl font-bold',
                      reportData.enps.score === null ? 'text-slate-400' :
                      reportData.enps.score >= 30 ? 'text-emerald-600' :
                      reportData.enps.score >= 0 ? 'text-green-600' :
                      reportData.enps.score >= -30 ? 'text-orange-600' : 'text-red-600'
                    )}>
                      {formatENPS(reportData.enps.score)}
                    </span>
                    {reportData.enps.risk && (
                      <Badge className={cn('text-sm px-3 py-1', getRiskBadgeClass(reportData.enps.risk.level))}>
                        {reportData.enps.risk.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    -100 〜 +100 の範囲
                  </p>
                </div>

                {/* Distribution */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                    <div className="flex items-center gap-3">
                      <ThumbsUp className="h-5 w-5 text-emerald-600" />
                      <div>
                        <p className="font-medium text-emerald-800">推奨者</p>
                        <p className="text-xs text-emerald-600">9-10点</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-700">{reportData.enps.promoters}</p>
                      <p className="text-xs text-emerald-600">
                        {reportData.enps.promoterPercentage?.toFixed(0) ?? '-'}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <Minus className="h-5 w-5 text-slate-500" />
                      <div>
                        <p className="font-medium text-slate-700">中立者</p>
                        <p className="text-xs text-slate-500">7-8点</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-600">{reportData.enps.passives}</p>
                      <p className="text-xs text-slate-500">
                        {reportData.enps.totalResponses > 0
                          ? ((reportData.enps.passives / reportData.enps.totalResponses) * 100).toFixed(0)
                          : '-'}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                    <div className="flex items-center gap-3">
                      <ThumbsDown className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="font-medium text-red-700">批判者</p>
                        <p className="text-xs text-red-500">0-6点</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-red-600">{reportData.enps.detractors}</p>
                      <p className="text-xs text-red-500">
                        {reportData.enps.detractorPercentage?.toFixed(0) ?? '-'}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">カテゴリ別スコア</CardTitle>
              <CardDescription>8つの評価カテゴリの詳細</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.categoryBreakdown.map(category => {
                  const isReverse = REVERSE_SCORED_CATEGORIES.includes(
                    category.category as typeof REVERSE_SCORED_CATEGORIES[number]
                  )
                  return (
                    <div
                      key={category.category}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {category.label.ja}
                          {isReverse && (
                            <span className="ml-2 text-xs text-orange-500 font-normal">
                              (低いほど良い)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{category.label.en}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Score */}
                        <div className="text-right">
                          <p className="text-2xl font-bold">
                            {category.score?.toFixed(2) ?? '-'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            業界平均: {category.benchmark?.toFixed(2) ?? '-'}
                          </p>
                        </div>

                        {/* Difference */}
                        <div className="w-20 text-right">
                          {category.difference !== null && (
                            <span
                              className={cn(
                                'text-sm font-medium',
                                isReverse
                                  ? (category.difference <= 0 ? 'text-green-600' : 'text-red-600')
                                  : (category.difference >= 0 ? 'text-green-600' : 'text-red-600')
                              )}
                            >
                              {category.difference >= 0 ? '+' : ''}
                              {category.difference.toFixed(1)}
                            </span>
                          )}
                        </div>

                        {/* Risk Badge */}
                        <div className="w-24">
                          {category.risk && (
                            <Badge className={cn('w-full justify-center', getRiskBadgeClass(category.risk.level))}>
                              {category.risk.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Comments Section */}
          {reportData.comments.total > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  従業員からのコメント
                </CardTitle>
                <CardDescription>
                  {reportData.comments.total} 件のコメント
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.comments.recent.map((comment, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-lg bg-slate-50 border border-slate-100"
                    >
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {comment.text}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(comment.submittedAt).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Confidence Notice */}
          {reportData.confidence.level === 'LOW' && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">
                      {reportData.confidence.label}
                    </p>
                    <p className="text-sm text-amber-700">
                      {reportData.confidence.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* No Data State */}
      {!loading && reportData && reportData.responseCount === 0 && (
        <Card className="mt-6">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              この店舗にはまだ回答がありません
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              QRコードを配布して回答を収集してください
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
