import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Store,
  BarChart3,
  Send,
  Users,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import Link from 'next/link'
import {
  calculateOverallScore,
  getOverallRiskLevel,
  formatScore,
} from '@/lib/scoring'
import { cn } from '@/lib/utils'

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  // SysAdmin should go to companies
  if (session.user.role === 'sysadmin') {
    redirect('/companies')
  }

  // Get admin with company details
  const admin = await prisma.admin.findUnique({
    where: { id: session.user.id },
    include: {
      company: {
        include: {
          _count: {
            select: {
              shops: true,
              admins: true,
            },
          },
          shops: {
            include: {
              _count: {
                select: {
                  responses: true,
                },
              },
              responses: {
                select: {
                  id: true,
                  answers: true,
                  submittedAt: true,
                },
                orderBy: { submittedAt: 'desc' },
              },
            },
          },
        },
      },
      shopAssignments: {
        select: { shopId: true },
      },
    },
  })

  if (!admin) {
    redirect('/login')
  }

  // Get accessible shops based on admin permissions
  let accessibleShops = admin.company.shops
  if (!admin.isFullAccess) {
    const assignedShopIds = new Set(admin.shopAssignments.map(a => a.shopId))
    // Include assigned shops and their descendants
    const getDescendantIds = (shopId: string): string[] => {
      const children = admin.company.shops.filter(s => s.parentId === shopId)
      return [shopId, ...children.flatMap(c => getDescendantIds(c.id))]
    }
    const allAccessibleIds = new Set(
      Array.from(assignedShopIds).flatMap(id => getDescendantIds(id))
    )
    accessibleShops = admin.company.shops.filter(s => allAccessibleIds.has(s.id))
  }

  // Calculate totals
  const totalShops = accessibleShops.length
  const totalResponses = accessibleShops.reduce(
    (acc, shop) => acc + shop._count.responses,
    0
  )

  // Get all responses for overall score calculation
  const allResponses = accessibleShops.flatMap(shop =>
    shop.responses.map(r => r.answers as Record<string, number>)
  )
  const overallScore = calculateOverallScore(allResponses)
  const overallRisk = overallScore !== null ? getOverallRiskLevel(overallScore) : null

  // Calculate per-shop scores
  const shopScores = accessibleShops.map(shop => {
    const shopAnswers = shop.responses.map(r => r.answers as Record<string, number>)
    const score = calculateOverallScore(shopAnswers)
    const risk = score !== null ? getOverallRiskLevel(score) : null
    return {
      id: shop.id,
      name: shop.name,
      responseCount: shop._count.responses,
      score,
      risk,
    }
  })

  // Get lowest scoring shops (with responses)
  const shopsWithScores = shopScores.filter(s => s.score !== null)
  const lowestScoringShops = [...shopsWithScores]
    .sort((a, b) => (a.score ?? 5) - (b.score ?? 5))
    .slice(0, 5)

  // Get recent responses (last 10)
  const recentResponses = accessibleShops
    .flatMap(shop =>
      shop.responses.map(r => ({
        id: r.id,
        shopId: shop.id,
        shopName: shop.name,
        submittedAt: r.submittedAt,
      }))
    )
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 10)

  // Count shops by risk level
  const riskCounts = {
    CRITICAL: shopScores.filter(s => s.risk?.level === 'CRITICAL').length,
    WARNING: shopScores.filter(s => s.risk?.level === 'WARNING').length,
    NO_DATA: shopScores.filter(s => s.risk === null).length,
  }

  // Count flagged responses for the company (important feedback alert)
  const accessibleShopIds = accessibleShops.map(s => s.id)
  const flaggedCount = await prisma.response.count({
    where: {
      shopId: { in: accessibleShopIds },
      flagged: true,
    },
  })

  const getRiskBadgeClass = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'WARNING':
        return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'CAUTION':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'STABLE':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'EXCELLENT':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="text-muted-foreground">{admin.company.name}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">事業所数</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalShops}</div>
            <p className="text-xs text-muted-foreground">管理事業所</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">回答数</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResponses}</div>
            <p className="text-xs text-muted-foreground">合計回答</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総合スコア</CardTitle>
            {overallScore !== null && overallScore < 3.0 ? (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ) : (
              <TrendingUp className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {formatScore(overallScore)}
              </span>
              {overallRisk && (
                <Badge className={cn('text-xs', getRiskBadgeClass(overallRisk.level))}>
                  {overallRisk.label}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">5点満点</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">要注意事業所</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {riskCounts.CRITICAL + riskCounts.WARNING}
            </div>
            <p className="text-xs text-muted-foreground">
              危険 {riskCounts.CRITICAL} / 注意 {riskCounts.WARNING}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Flagged Responses Alert */}
      {flaggedCount > 0 && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-orange-900">
                {flaggedCount}件の重要なフィードバックがあります
              </p>
              <p className="text-sm text-orange-700">
                詳細は運営事務局にお問い合わせください
              </p>
            </div>
            <a
              href="mailto:support@techcrew.co.jp"
              className="inline-flex items-center justify-center rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
            >
              お問い合わせ
            </a>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lowest Scoring Shops */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              低スコア事業所
            </CardTitle>
            <CardDescription>改善が必要な事業所</CardDescription>
          </CardHeader>
          <CardContent>
            {lowestScoringShops.length > 0 ? (
              <div className="space-y-3">
                {lowestScoringShops.map(shop => (
                  <Link
                    key={shop.id}
                    href={`/reports?shop=${shop.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Store className="h-4 w-4 text-slate-500" />
                      <div>
                        <p className="font-medium text-sm">{shop.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {shop.responseCount} 回答
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">
                        {formatScore(shop.score)}
                      </span>
                      {shop.risk && (
                        <Badge
                          className={cn('text-xs', getRiskBadgeClass(shop.risk.level))}
                        >
                          {shop.risk.label}
                        </Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                まだ回答データがありません
              </p>
            )}
            {shopsWithScores.length > 5 && (
              <div className="mt-4">
                <Link href="/reports">
                  <Button variant="outline" size="sm" className="w-full">
                    すべての事業所を見る
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Responses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-500" />
              最近の回答
            </CardTitle>
            <CardDescription>直近10件</CardDescription>
          </CardHeader>
          <CardContent>
            {recentResponses.length > 0 ? (
              <div className="space-y-3">
                {recentResponses.map(response => (
                  <div
                    key={response.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Store className="h-4 w-4 text-slate-500" />
                      <span className="font-medium text-sm">{response.shopName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(response.submittedAt).toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                まだ回答がありません
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3 mt-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4" />
              事業所管理
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/shops">
              <Button className="w-full" size="sm">
                事業所一覧
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              レポート
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/reports">
              <Button className="w-full" variant="outline" size="sm">
                詳細レポート
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" />
              アンケート配布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/shops">
              <Button className="w-full" variant="outline" size="sm">
                QRコード取得
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Getting Started */}
      {totalShops === 0 && (
        <Card className="mt-6 border-dashed">
          <CardHeader>
            <CardTitle>はじめに</CardTitle>
            <CardDescription>
              アンケート回答を収集するための手順
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  1
                </span>
                <span>最初の事業所を追加する</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  2
                </span>
                <span className="text-muted-foreground">事業所のQRコードを生成</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  3
                </span>
                <span className="text-muted-foreground">
                  QRコードを事業所に設置して従業員にスキャンしてもらう
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  4
                </span>
                <span className="text-muted-foreground">
                  レポートセクションで回答結果を確認
                </span>
              </li>
            </ol>
            <div className="mt-6">
              <Link href="/shops/new">
                <Button>
                  <Store className="mr-2 h-4 w-4" />
                  最初の事業所を追加
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
