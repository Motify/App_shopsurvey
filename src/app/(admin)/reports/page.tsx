'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { ScoreRadarChart } from '@/components/charts/ScoreRadarChart'
import { TrendLineChart, ENPSTrendChart } from '@/components/charts/TrendLineChart'
import { AnalysisDisplay } from '@/components/reports/AnalysisDisplay'
import {
  QuestionAnalysis,
  CorrelationAnalysis,
  PatternAlerts,
  PercentileDisplay,
} from '@/components/reports/AnalyticsComponents'
import {
  Loader2,
  Store,
  AlertTriangle,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  MessageSquare,
  Users,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Download,
  Calendar,
  TrendingUp,
  BarChart3,
  Lightbulb,
  Heart,
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
  change?: { value: number; direction: 'up' | 'down' | 'same' } | null
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
  change?: { value: number; direction: 'up' | 'down' | 'same' } | null
}

interface Comment {
  text: string
  submittedAt: string
}

interface ComparisonData {
  period: { startDate: string; endDate: string }
  responseCount: number
  overallScore: number | null
  categoryScores: Record<CategoryKey, number | null>
  enps: { score: number | null }
  changes: {
    overall: { value: number; direction: string; percentage: number | null } | null
    categories: Record<CategoryKey, { value: number; direction: string } | null>
    enps: { value: number; direction: string } | null
  }
}

interface RetentionIntentionData {
  score: number | null
  risk: { level: string; label: string; color: string }
}

interface ReportData {
  shop: {
    id: string
    name: string
    companyName: string
    industry: string
  }
  period?: { startDate: string | null; endDate: string | null } | null
  includesChildren: boolean
  shopCount: number
  responseCount: number
  overallScore: number | null
  overallRisk: { level: string; label: string; color: string } | null
  benchmarkOverall: number | null
  categoryBreakdown: CategoryBreakdown[]
  confidence: { level: string; label: string; description: string }
  retentionIntention: RetentionIntentionData
  enps: ENPSData
  comparison: ComparisonData | null
  comments: {
    total: number
    recent: Comment[]
  }
}

interface TrendDataPoint {
  month: string
  responseCount: number
  overallScore: number | null
  categoryScores: Record<CategoryKey, number | null> | null
  enps: number | null
}

// Quick date range presets
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

// Change indicator component
function ChangeIndicator({ change, isReverse = false }: { change: { value: number; direction: string } | null; isReverse?: boolean }) {
  if (!change) return null

  const isPositive = isReverse
    ? change.direction === 'down'
    : change.direction === 'up'

  const isNegative = isReverse
    ? change.direction === 'up'
    : change.direction === 'down'

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-sm font-medium',
        isPositive && 'text-green-600',
        isNegative && 'text-red-600',
        change.direction === 'same' && 'text-slate-500'
      )}
    >
      {change.direction === 'up' && <ArrowUpRight className="h-4 w-4" />}
      {change.direction === 'down' && <ArrowDownRight className="h-4 w-4" />}
      {change.direction === 'same' && <ArrowRight className="h-4 w-4" />}
      {change.value >= 0 ? '+' : ''}{change.value.toFixed(2)}
    </div>
  )
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

  // Date filtering
  const [datePreset, setDatePreset] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Comparison mode
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [compareStartDate, setCompareStartDate] = useState('')
  const [compareEndDate, setCompareEndDate] = useState('')

  // Trend data
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [showTrend, setShowTrend] = useState(false)

  // PDF export
  const [pdfLoading, setPdfLoading] = useState(false)

  // Active tab
  const [activeTab, setActiveTab] = useState<'overview' | 'trend' | 'analysis' | 'analytics'>('overview')

  // Analytics data
  const [analyticsData, setAnalyticsData] = useState<{
    questions: { all: unknown[]; lowestScoring: unknown[]; highestScoring: unknown[] }
    correlations: { data: unknown[] | null; insight: { ja: string; en: string } | null; message?: string; currentCount?: number; minResponses: number }
    patterns: unknown[]
    percentile: { percentile: number; rank: number; totalShops: number; score: number } | null
  } | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsCacheKey, setAnalyticsCacheKey] = useState('')

  // Fetch shops on mount
  useEffect(() => {
    fetchShops()
  }, [])

  // Fetch report when shop or filters change
  useEffect(() => {
    if (selectedShopId) {
      fetchReport()
    } else {
      setReportData(null)
    }
  }, [selectedShopId, includeChildren, customStartDate, customEndDate, compareEnabled, compareStartDate, compareEndDate])

  // Fetch trend when enabled
  useEffect(() => {
    if (selectedShopId && showTrend) {
      fetchTrend()
    }
  }, [selectedShopId, includeChildren, showTrend])

  // Fetch analytics when tab selected (with caching)
  useEffect(() => {
    if (selectedShopId && activeTab === 'analytics') {
      const cacheKey = `${selectedShopId}-${customStartDate}-${customEndDate}`
      // Only fetch if we don't have cached data for this configuration
      if (cacheKey !== analyticsCacheKey) {
        fetchAnalytics()
        setAnalyticsCacheKey(cacheKey)
      }
    }
  }, [selectedShopId, activeTab, customStartDate, customEndDate, analyticsCacheKey])

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
      const params = new URLSearchParams()
      params.set('includeChildren', String(includeChildren))

      if (customStartDate) params.set('startDate', customStartDate)
      if (customEndDate) params.set('endDate', customEndDate)

      if (compareEnabled && compareStartDate && compareEndDate) {
        params.set('compareStartDate', compareStartDate)
        params.set('compareEndDate', compareEndDate)
      }

      const response = await fetch(`/api/reports/shop/${selectedShopId}?${params}`)
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

  const fetchTrend = async () => {
    setTrendLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('includeChildren', String(includeChildren))
      params.set('months', '12')

      const response = await fetch(`/api/reports/shop/${selectedShopId}/trend?${params}`)
      if (response.ok) {
        const data = await response.json()
        setTrendData(data.trend)
      }
    } catch (err) {
      console.error('Failed to fetch trend:', err)
    } finally {
      setTrendLoading(false)
    }
  }

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true)
    try {
      const params = new URLSearchParams()
      if (customStartDate) params.set('startDate', customStartDate)
      if (customEndDate) params.set('endDate', customEndDate)

      const response = await fetch(`/api/reports/shop/${selectedShopId}/analytics?${params}`)
      if (response.ok) {
        const data = await response.json()
        setAnalyticsData(data)
      } else {
        const error = await response.json()
        console.error('Analytics error:', error)
        setAnalyticsData(null)
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const handleShopChange = (shopId: string) => {
    setSelectedShopId(shopId)
    router.push(`/reports?shop=${shopId}`)
  }

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset)
    const { startDate, endDate } = getDateFromPreset(preset)
    setCustomStartDate(startDate || '')
    setCustomEndDate(endDate || '')

    // Auto-suggest comparison period
    if (preset !== 'all' && startDate && endDate) {
      const duration = new Date(endDate).getTime() - new Date(startDate).getTime()
      const compareEnd = new Date(new Date(startDate).getTime() - 1)
      const compareStart = new Date(compareEnd.getTime() - duration)
      setCompareStartDate(formatDateForInput(compareStart))
      setCompareEndDate(formatDateForInput(compareEnd))
    }
  }

  const handleDownloadPDF = async () => {
    if (!selectedShopId) return

    setPdfLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('includeChildren', String(includeChildren))
      if (customStartDate) params.set('startDate', customStartDate)
      if (customEndDate) params.set('endDate', customEndDate)

      const response = await fetch(`/api/reports/shop/${selectedShopId}/pdf?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `report-${reportData?.shop.name || 'shop'}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err) {
      console.error('Failed to download PDF:', err)
    } finally {
      setPdfLoading(false)
    }
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">レポート</h1>
          <p className="text-muted-foreground">事業所ごとの詳細スコアと分析</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/reports/compare')}>
            <BarChart3 className="mr-2 h-4 w-4" />
            事業所比較
          </Button>
          {reportData && (
            <Button onClick={handleDownloadPDF} disabled={pdfLoading} variant="outline">
              {pdfLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              PDFをダウンロード
            </Button>
          )}
        </div>
      </div>

      {/* Shop Selection & Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">フィルター設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Shop Selection */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label className="mb-2 block">事業所</Label>
              <Select
                value={selectedShopId}
                onValueChange={handleShopChange}
                disabled={shopsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="事業所を選択..." />
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
            <div className="flex items-end gap-2">
              <Checkbox
                id="includeChildren"
                checked={includeChildren}
                onCheckedChange={(checked) => setIncludeChildren(checked === true)}
              />
              <label
                htmlFor="includeChildren"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                子事業所を含める
              </label>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              期間
            </Label>
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
            <div className="flex gap-4 mt-2">
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
          </div>

          {/* Comparison Toggle */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Switch
                id="compare-mode"
                checked={compareEnabled}
                onCheckedChange={setCompareEnabled}
              />
              <Label htmlFor="compare-mode" className="cursor-pointer">
                期間比較を有効にする
              </Label>
            </div>
          </div>

          {/* Comparison Period */}
          {compareEnabled && (
            <div className="flex gap-4 p-3 bg-slate-50 rounded-lg">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">比較期間 開始</Label>
                <Input
                  type="date"
                  value={compareStartDate}
                  onChange={(e) => setCompareStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">比較期間 終了</Label>
                <Input
                  type="date"
                  value={compareEndDate}
                  onChange={(e) => setCompareEndDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      {selectedShopId && (
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            onClick={() => setActiveTab('overview')}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            概要
          </Button>
          <Button
            variant={activeTab === 'trend' ? 'default' : 'outline'}
            onClick={() => {
              setActiveTab('trend')
              setShowTrend(true)
            }}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            トレンド
          </Button>
          <Button
            variant={activeTab === 'analysis' ? 'default' : 'outline'}
            onClick={() => setActiveTab('analysis')}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            AI分析
          </Button>
          <Button
            variant={activeTab === 'analytics' ? 'default' : 'outline'}
            onClick={() => setActiveTab('analytics')}
          >
            <Lightbulb className="mr-2 h-4 w-4" />
            詳細分析
          </Button>
        </div>
      )}

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
            <p className="text-muted-foreground">事業所を選択してレポートを表示</p>
          </CardContent>
        </Card>
      )}

      {/* Trend View */}
      {!loading && activeTab === 'trend' && selectedShopId && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                スコア推移
              </CardTitle>
              <CardDescription>過去12ヶ月の総合スコアの推移</CardDescription>
            </CardHeader>
            <CardContent>
              {trendLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : trendData.length > 0 ? (
                <TrendLineChart data={trendData} height={350} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  データがありません
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">eNPS推移</CardTitle>
              <CardDescription>従業員推奨度の推移</CardDescription>
            </CardHeader>
            <CardContent>
              {trendLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : trendData.length > 0 ? (
                <ENPSTrendChart data={trendData} height={300} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  データがありません
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Analysis View - Keep mounted to preserve cache */}
      {selectedShopId && (
        <div className={activeTab === 'analysis' ? '' : 'hidden'}>
          <AnalysisDisplay
            shopId={selectedShopId}
            startDate={customStartDate || undefined}
            endDate={customEndDate || undefined}
            includeChildren={includeChildren}
          />
        </div>
      )}

      {/* Advanced Analytics View */}
      {!loading && activeTab === 'analytics' && selectedShopId && (
        <div className="space-y-6">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : analyticsData ? (
            <>
              {/* Top row: Percentile and Correlation */}
              <div className="grid gap-6 md:grid-cols-2">
                <PercentileDisplay percentile={analyticsData.percentile} />
                <CorrelationAnalysis data={analyticsData.correlations as Parameters<typeof CorrelationAnalysis>[0]['data']} />
              </div>

              {/* Pattern Alerts */}
              <PatternAlerts patterns={analyticsData.patterns as Parameters<typeof PatternAlerts>[0]['patterns']} />

              {/* Question Analysis */}
              <QuestionAnalysis data={analyticsData.questions as Parameters<typeof QuestionAnalysis>[0]['data']} />
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  分析データを取得できませんでした
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  回答数が3件以上必要です
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Report Display */}
      {!loading && activeTab === 'overview' && reportData && (
        <div className="space-y-6">
          {/* Comparison Summary */}
          {reportData.comparison && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  期間比較
                </CardTitle>
                <CardDescription>
                  前期間: {reportData.comparison.responseCount}件の回答
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {/* Overall Change */}
                  <div className="p-4 bg-white rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">総合スコア変化</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">
                        {reportData.comparison.overallScore?.toFixed(2) ?? '-'}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">
                        {reportData.overallScore?.toFixed(2) ?? '-'}
                      </span>
                      {reportData.comparison.changes.overall && (
                        <ChangeIndicator change={reportData.comparison.changes.overall as { value: number; direction: 'up' | 'down' | 'same' }} />
                      )}
                    </div>
                  </div>

                  {/* eNPS Change */}
                  <div className="p-4 bg-white rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">eNPS変化</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">
                        {formatENPS(reportData.comparison.enps.score)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">
                        {formatENPS(reportData.enps.score)}
                      </span>
                      {reportData.comparison.changes.enps && (
                        <ChangeIndicator change={reportData.comparison.changes.enps as { value: number; direction: 'up' | 'down' | 'same' }} />
                      )}
                    </div>
                  </div>

                  {/* Response Count Change */}
                  <div className="p-4 bg-white rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">回答数変化</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">
                        {reportData.comparison.responseCount}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">
                        {reportData.responseCount}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Overall Score Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{reportData.shop.name}</CardTitle>
                  <CardDescription>
                    {reportData.includesChildren && reportData.shopCount > 1
                      ? `${reportData.shopCount} 事業所の集計`
                      : '単一事業所'}
                    {' • '}
                    {reportData.responseCount} 件の回答
                    {reportData.period?.startDate && reportData.period?.endDate && (
                      <span className="ml-2 text-xs">
                        ({new Date(reportData.period.startDate).toLocaleDateString('ja-JP')} - {new Date(reportData.period.endDate).toLocaleDateString('ja-JP')})
                      </span>
                    )}
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
                  {reportData.enps.change && (
                    <div className="mt-2">
                      <ChangeIndicator change={reportData.enps.change} />
                    </div>
                  )}
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

          {/* Retention Intention Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="h-5 w-5" />
                定着意向
              </CardTitle>
              <CardDescription>
                「今後も働き続けたいと思いますか？」への回答
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl">
                <p className="text-sm text-muted-foreground mb-2">定着意向スコア</p>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'text-5xl font-bold',
                    reportData.retentionIntention.score === null ? 'text-slate-400' :
                    reportData.retentionIntention.score >= 3.8 ? 'text-emerald-600' :
                    reportData.retentionIntention.score >= 3.2 ? 'text-green-600' :
                    reportData.retentionIntention.score >= 2.7 ? 'text-yellow-600' :
                    reportData.retentionIntention.score >= 2.0 ? 'text-orange-600' : 'text-red-600'
                  )}>
                    {reportData.retentionIntention.score?.toFixed(2) ?? '-'}
                  </span>
                  {reportData.retentionIntention.risk && (
                    <Badge className={cn('text-sm px-3 py-1', getRiskBadgeClass(reportData.retentionIntention.risk.level))}>
                      {reportData.retentionIntention.risk.label}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">5点満点</p>
                <p className="text-sm text-muted-foreground mt-4 text-center max-w-md">
                  この指標は従業員の継続勤務意向を直接測定します。
                  ドライバー8カテゴリの改善によりこのスコアの向上が期待できます。
                </p>
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

                        {/* Change */}
                        {category.change && (
                          <div className="w-16">
                            <ChangeIndicator change={category.change} isReverse={isReverse} />
                          </div>
                        )}

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
              この事業所にはまだ回答がありません
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
