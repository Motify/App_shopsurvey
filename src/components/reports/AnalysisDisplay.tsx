'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, Lightbulb, AlertCircle, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ThemeResult {
  theme: string
  themeEn: string
  count: number
  percentage: number
  examples: string[]
}

interface ImprovementTheme extends ThemeResult {
  suggestedAction: string
}

interface AnalysisData {
  positiveThemes: ThemeResult[]
  improvementThemes: ImprovementTheme[]
  summary: string
  summaryEn: string
  responseCount: number
  positiveCount?: number
  negativeCount?: number
  neutralCount?: number
  totalComments?: number
  sampledComments?: number
  cached?: boolean
  cachedAt?: string
}

interface AnalysisDisplayProps {
  shopId: string
  startDate?: string
  endDate?: string
  includeChildren?: boolean
}

export function AnalysisDisplay({
  shopId,
  startDate,
  endDate,
  includeChildren = false,
}: AnalysisDisplayProps) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ message: string; responseCount?: number } | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  // Track the configuration that was used to fetch the current cached analysis (using ref to avoid re-renders)
  const cachedConfigRef = useRef('')

  // Auto-load analysis on mount or when configuration changes (will use API cache if available)
  useEffect(() => {
    const currentConfig = `${shopId}-${startDate}-${endDate}-${includeChildren}`
    // Only fetch if the configuration changed (not on tab switches)
    if (currentConfig !== cachedConfigRef.current) {
      // Show loading state when configuration actually changes (not on first mount)
      if (cachedConfigRef.current !== '') {
        setInitialLoading(true)
        setAnalysis(null)
      }
      cachedConfigRef.current = currentConfig
      fetchAnalysis(false)
    }
  }, [shopId, startDate, endDate, includeChildren])

  const fetchAnalysis = async (refresh = false) => {
    if (refresh) {
      setLoading(true)
    }
    setError(null)

    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (includeChildren) params.append('includeChildren', 'true')
      if (refresh) params.append('refresh', 'true')

      const response = await fetch(`/api/reports/shop/${shopId}/analysis?${params}`)
      const data = await response.json()

      if (!response.ok) {
        setError({
          message: data.message || data.error || 'エラーが発生しました',
          responseCount: data.responseCount,
        })
        setAnalysis(null)
      } else {
        setAnalysis(data)
        setError(null)
      }
    } catch (err) {
      console.error('Failed to fetch analysis:', err)
      setError({ message: 'AI分析の取得に失敗しました' })
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }

  // Initial loading state
  if (initialLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            AIコメント分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
            <p className="text-muted-foreground">分析データを読み込み中...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            AIコメント分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">{error.message}</p>
            {error.responseCount !== undefined && (
              <p className="text-sm text-muted-foreground">
                現在のテキスト回答数: {error.responseCount}件
              </p>
            )}
            <Button
              variant="outline"
              onClick={() => fetchAnalysis(true)}
              className="mt-4"
            >
              再試行
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Analysis results
  if (!analysis) return null

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                AIコメント分析
              </CardTitle>
              <CardDescription>
                {analysis.totalComments && analysis.sampledComments && analysis.totalComments > analysis.sampledComments ? (
                  <>{analysis.totalComments}件中{analysis.sampledComments}件をランダムサンプリングして分析</>
                ) : (
                  <>{analysis.responseCount}件のテキスト回答を分析</>
                )}
                {analysis.cached && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    キャッシュ済み
                  </Badge>
                )}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAnalysis(true)}
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
              再分析
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-700 leading-relaxed">
              {analysis.summary}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Positive Themes */}
      {analysis.positiveThemes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-xl">😊</span>
              従業員が評価している点
            </CardTitle>
            <CardDescription>
              「働き続けたい理由」の主要テーマ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysis.positiveThemes.map((theme, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-slate-400">
                        {index + 1}
                      </span>
                      <span className="font-bold text-slate-900">
                        {theme.theme}
                      </span>
                    </div>
                    <Badge variant="secondary">
                      {theme.count}件 ({theme.percentage}%)
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {theme.themeEn}
                  </p>
                  <div className="space-y-2">
                    {theme.examples.map((example, i) => (
                      <p
                        key={i}
                        className="text-sm text-slate-600 pl-4 border-l-2 border-emerald-200"
                      >
                        「{example}」
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Improvement Themes */}
      {analysis.improvementThemes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-xl">📝</span>
              改善が求められている点
            </CardTitle>
            <CardDescription>
              「改善してほしいこと」の主要テーマ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysis.improvementThemes.map((theme, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-slate-400">
                        {index + 1}
                      </span>
                      <span className="font-bold text-slate-900">
                        {theme.theme}
                      </span>
                    </div>
                    <Badge variant="secondary">
                      {theme.count}件 ({theme.percentage}%)
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {theme.themeEn}
                  </p>
                  <div className="space-y-2 mb-3">
                    {theme.examples.map((example, i) => (
                      <p
                        key={i}
                        className="text-sm text-slate-600 pl-4 border-l-2 border-amber-200"
                      >
                        「{example}」
                      </p>
                    ))}
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-medium text-blue-700">
                        推奨アクション:
                      </span>
                      <p className="text-sm text-blue-800 mt-1">
                        {theme.suggestedAction}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state for both */}
      {analysis.positiveThemes.length === 0 && analysis.improvementThemes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-muted-foreground">
              分析可能なテキスト回答がありませんでした
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
