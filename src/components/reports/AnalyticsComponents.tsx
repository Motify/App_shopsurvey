'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, TrendingUp, TrendingDown, Award, Target, Info, CheckCircle } from 'lucide-react'

// ===== Types =====

interface QuestionStat {
  questionId: string
  order: number
  textJa: string
  textEn: string
  category: string
  average: number | null
  median: number | null
  stdDev: number | null
  distribution: Record<number, number>
  responseCount: number
  riskLevel: { level: string; label: string; color: string } | null
}

interface CorrelationItem {
  category: string
  categoryLabel: { ja: string; en: string }
  correlation: number
  impact: number
}

interface Pattern {
  type: string
  severity: 'info' | 'warning' | 'error'
  title: string
  description: string
  metric: string
}

interface PercentileData {
  percentile: number
  rank: number
  totalShops: number
  score: number
}

// ===== Mini Distribution Bar =====

export function MiniDistribution({ data }: { data: Record<number, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0)
  if (total === 0) return <div className="w-24 h-4 bg-gray-100 rounded" />

  const colors: Record<number, string> = {
    1: '#EF4444', // red
    2: '#F97316', // orange
    3: '#EAB308', // yellow
    4: '#22C55E', // green
    5: '#10B981', // emerald
  }

  return (
    <div className="flex h-4 w-24 rounded overflow-hidden" title="回答分布">
      {[1, 2, 3, 4, 5].map(score => {
        const count = data[score] || 0
        const percentage = (count / total) * 100
        if (percentage === 0) return null
        return (
          <div
            key={score}
            style={{
              width: `${percentage}%`,
              backgroundColor: colors[score],
            }}
            title={`${score}点: ${count}件 (${percentage.toFixed(0)}%)`}
          />
        )
      })}
    </div>
  )
}

// ===== Risk Badge =====

function RiskBadge({ level }: { level: { level: string; label: string; color: string } | null }) {
  if (!level) return <span className="text-gray-400">-</span>

  const colorClasses: Record<string, string> = {
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    green: 'bg-green-100 text-green-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    orange: 'bg-orange-100 text-orange-700',
  }

  return (
    <Badge className={cn('text-xs', colorClasses[level.color] || 'bg-gray-100 text-gray-700')}>
      {level.label}
    </Badge>
  )
}

// ===== Question Card =====

function QuestionCard({ question, variant }: { question: QuestionStat; variant: 'warning' | 'success' }) {
  const isWarning = variant === 'warning'

  return (
    <div
      className={cn(
        'p-4 rounded-lg border mb-2',
        isWarning ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="font-medium">
          Q{question.order}: {question.textJa}
        </span>
        <RiskBadge level={question.riskLevel} />
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className={cn('font-bold text-lg', isWarning ? 'text-red-600' : 'text-green-600')}>
          {question.average?.toFixed(2) ?? '-'}
        </span>
        <span className="text-gray-500">中央値: {question.median ?? '-'}</span>
        <span className="text-gray-500">回答: {question.responseCount}件</span>
        <MiniDistribution data={question.distribution} />
      </div>
    </div>
  )
}

// ===== Question Analysis Component =====

interface QuestionAnalysisProps {
  data: {
    all: QuestionStat[]
    lowestScoring: QuestionStat[]
    highestScoring: QuestionStat[]
  }
}

export function QuestionAnalysis({ data }: QuestionAnalysisProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5" />
          質問別分析
        </CardTitle>
        <CardDescription>各質問のスコア詳細と回答分布</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Lowest scoring questions */}
        {data.lowestScoring.length > 0 && (
          <div>
            <h4 className="text-red-600 font-medium mb-3 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              要注意の質問 (スコアが低い)
            </h4>
            {data.lowestScoring.map(q => (
              <QuestionCard key={q.order} question={q} variant="warning" />
            ))}
          </div>
        )}

        {/* Highest scoring questions */}
        {data.highestScoring.length > 0 && (
          <div>
            <h4 className="text-green-600 font-medium mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              強みの質問 (スコアが高い)
            </h4>
            {data.highestScoring.map(q => (
              <QuestionCard key={q.order} question={q} variant="success" />
            ))}
          </div>
        )}

        {/* All questions table */}
        <div>
          <h4 className="font-medium mb-3">全質問一覧</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-2">Q#</th>
                  <th className="text-left p-2">質問</th>
                  <th className="text-center p-2">平均</th>
                  <th className="text-center p-2">中央値</th>
                  <th className="text-center p-2">分布</th>
                  <th className="text-center p-2">判定</th>
                </tr>
              </thead>
              <tbody>
                {data.all.map(q => (
                  <tr key={q.order} className="border-b hover:bg-slate-50">
                    <td className="p-2 font-medium">Q{q.order}</td>
                    <td className="p-2 max-w-xs truncate" title={q.textJa}>
                      {q.textJa}
                    </td>
                    <td className="p-2 text-center font-mono">
                      {q.average?.toFixed(2) ?? '-'}
                    </td>
                    <td className="p-2 text-center">{q.median ?? '-'}</td>
                    <td className="p-2">
                      <div className="flex justify-center">
                        <MiniDistribution data={q.distribution} />
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      <RiskBadge level={q.riskLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ===== Correlation Analysis Component =====

interface CorrelationAnalysisProps {
  data: {
    data: CorrelationItem[] | null
    insight: { ja: string; en: string } | null
    message?: string
    currentCount?: number
    minResponses: number
  }
}

export function CorrelationAnalysis({ data }: CorrelationAnalysisProps) {
  if (!data.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            影響度分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{data.message}</p>
            {data.currentCount !== undefined && (
              <p className="text-sm mt-1">
                現在の回答数: {data.currentCount}件 / 必要: {data.minResponses}件
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5" />
          影響度分析
        </CardTitle>
        <CardDescription>
          各カテゴリが総合スコアにどれだけ影響しているかを示します
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Impact chart */}
        <div className="space-y-3">
          {data.data.map((c, i) => (
            <div key={c.category} className="flex items-center gap-3">
              <span className="w-28 text-sm truncate" title={c.categoryLabel.ja}>
                {c.categoryLabel.ja}
              </span>
              <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded transition-all',
                    i === 0 ? 'bg-blue-500' : 'bg-blue-300'
                  )}
                  style={{ width: `${Math.min(c.impact * 100, 100)}%` }}
                />
              </div>
              <span className="w-14 text-sm text-right font-mono">
                {(c.impact * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>

        {/* Insight box */}
        {data.insight && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
              {data.insight.ja}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ===== Pattern Alerts Component =====

interface PatternAlertsProps {
  patterns: Pattern[]
}

export function PatternAlerts({ patterns }: PatternAlertsProps) {
  if (patterns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            パターン検出
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-green-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              特異なパターンは検出されませんでした
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          検出されたパターン
        </CardTitle>
        <CardDescription>回答データから検出された注意すべきパターン</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {patterns.map((pattern, i) => (
            <div
              key={i}
              className={cn(
                'p-4 rounded-lg border-l-4',
                pattern.severity === 'warning' && 'bg-yellow-50 border-yellow-500',
                pattern.severity === 'info' && 'bg-blue-50 border-blue-500',
                pattern.severity === 'error' && 'bg-red-50 border-red-500'
              )}
            >
              <div className="flex justify-between items-start">
                <span className="font-medium">{pattern.title}</span>
                <Badge variant="outline" className="text-xs">
                  {pattern.metric}
                </Badge>
              </div>
              <p className="text-sm mt-1 text-gray-600">{pattern.description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ===== Percentile Display Component =====

interface PercentileDisplayProps {
  percentile: PercentileData | null
}

export function PercentileDisplay({ percentile }: PercentileDisplayProps) {
  if (!percentile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5" />
            業界内順位
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>順位データが利用できません</p>
            <p className="text-sm mt-1">比較可能な店舗が不足しています</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getMessage = (p: number) => {
    if (p >= 90) return { text: '業界トップ10%', color: 'text-emerald-600', bgColor: 'bg-emerald-50' }
    if (p >= 75) return { text: '業界上位25%', color: 'text-green-600', bgColor: 'bg-green-50' }
    if (p >= 50) return { text: '業界平均以上', color: 'text-blue-600', bgColor: 'bg-blue-50' }
    if (p >= 25) return { text: '業界平均以下', color: 'text-yellow-600', bgColor: 'bg-yellow-50' }
    return { text: '改善が必要', color: 'text-red-600', bgColor: 'bg-red-50' }
  }

  const message = getMessage(percentile.percentile)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Award className="h-5 w-5" />
          業界内順位
        </CardTitle>
        <CardDescription>同業他社との比較</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={cn('text-center p-6 rounded-lg', message.bgColor)}>
          <div className="text-5xl font-bold">{percentile.percentile}%</div>
          <div className={cn('text-lg font-medium mt-2', message.color)}>
            {message.text}
          </div>
          <div className="text-sm text-gray-500 mt-3">
            {percentile.totalShops}社中 {percentile.rank}位
          </div>
          <div className="text-xs text-gray-400 mt-1">
            総合スコア: {percentile.score.toFixed(2)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ===== Analytics Summary for Export =====

interface AnalyticsSummaryProps {
  data: {
    questions: {
      lowestScoring: QuestionStat[]
      highestScoring: QuestionStat[]
    }
    correlations: {
      data: CorrelationItem[] | null
    }
    patterns: Pattern[]
    percentile: PercentileData | null
  }
}

export function AnalyticsSummary({ data }: AnalyticsSummaryProps) {
  return (
    <div className="space-y-4 text-sm">
      {/* Percentile */}
      {data.percentile && (
        <div>
          <h4 className="font-medium">業界内順位</h4>
          <p>
            {data.percentile.totalShops}社中 {data.percentile.rank}位
            （上位 {100 - data.percentile.percentile}%）
          </p>
        </div>
      )}

      {/* Top impact */}
      {data.correlations.data && data.correlations.data.length > 0 && (
        <div>
          <h4 className="font-medium">最も影響度の高いカテゴリ</h4>
          <p>{data.correlations.data[0].categoryLabel.ja}</p>
        </div>
      )}

      {/* Patterns */}
      {data.patterns.length > 0 && (
        <div>
          <h4 className="font-medium">検出されたパターン</h4>
          <ul className="list-disc list-inside">
            {data.patterns.slice(0, 3).map((p, i) => (
              <li key={i}>{p.title}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Lowest questions */}
      {data.questions.lowestScoring.length > 0 && (
        <div>
          <h4 className="font-medium">要注意の質問</h4>
          <ul className="list-disc list-inside">
            {data.questions.lowestScoring.map(q => (
              <li key={q.order}>
                Q{q.order}: {q.average?.toFixed(2)}点
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
