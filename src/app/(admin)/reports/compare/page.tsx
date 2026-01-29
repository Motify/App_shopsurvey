'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShopMultiSelector } from '@/components/reports/ShopMultiSelector'
import { ComparisonRadarChart } from '@/components/reports/ComparisonCharts'
import { ComparisonTable, GapInsights } from '@/components/reports/ComparisonTable'
import { RankingsView } from '@/components/reports/RankingsView'
import { Loader2, BarChart3, Table, Trophy, AlertTriangle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Shop {
  id: string
  name: string
  parentId: string | null
  children?: Shop[]
}

interface ShopReport {
  shop: {
    id: string
    name: string
    parentId: string | null
  }
  scores: {
    overall: number | null
    categories: Record<string, number | null>
    enps: number | null
  }
  responseCount: number
}

interface GapAnalysis {
  category: string
  categoryKey: string
  best: { shop: string; score: number }
  worst: { shop: string; score: number }
  gap: number
}

interface ComparisonData {
  shops: ShopReport[]
  benchmark: Record<string, number>
  rankings: {
    overall: ShopReport[]
    byCategory: Record<string, ShopReport[]>
  }
  gaps: GapAnalysis[]
  warnings: Array<{
    shopId: string
    shopName: string
    responseCount: number
    message: string
  }>
}

type ViewTab = 'chart' | 'table' | 'rankings'

export default function CompareReportsPage() {
  const searchParams = useSearchParams()
  const initialShopIds = searchParams.get('shopIds')?.split(',').filter(id => id) || []

  const [shops, setShops] = useState<Shop[]>([])
  const [selectedShops, setSelectedShops] = useState<string[]>(initialShopIds)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [shopsLoading, setShopsLoading] = useState(true)
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ViewTab>('chart')

  // Fetch available shops
  useEffect(() => {
    fetchShops()
  }, [])

  // Auto-run comparison if shopIds provided in URL
  useEffect(() => {
    if (initialShopIds.length >= 2 && shops.length > 0) {
      runComparison()
    }
  }, [shops])

  const fetchShops = async () => {
    try {
      const response = await fetch('/api/shops')
      const data = await response.json()
      if (response.ok) {
        setShops(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Failed to fetch shops:', err)
    } finally {
      setShopsLoading(false)
    }
  }

  const runComparison = async () => {
    if (selectedShops.length < 2) {
      setError('最低2事業所を選択してください')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.append('shopIds', selectedShops.join(','))
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/reports/compare?${params}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '比較データの取得に失敗しました')
        setComparisonData(null)
      } else {
        setComparisonData(data)
      }
    } catch (err) {
      console.error('Failed to fetch comparison:', err)
      setError('比較データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/reports">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            戻る
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">事業所比較レポート</h1>
          <p className="text-muted-foreground">
            複数事業所のスコアを比較分析します
          </p>
        </div>
      </div>

      {/* Selection Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">比較する事業所を選択</CardTitle>
          <CardDescription>
            2〜5事業所を選択して比較できます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {shopsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <ShopMultiSelector
                shops={shops}
                selected={selectedShops}
                onChange={setSelectedShops}
                min={2}
                max={5}
              />

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label htmlFor="startDate">開始日</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">終了日</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <Button
                onClick={runComparison}
                disabled={selectedShops.length < 2 || loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    比較中...
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    比較する
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {comparisonData && (
        <>
          {/* Warnings */}
          {comparisonData.warnings.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="py-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    {comparisonData.warnings.map((w) => (
                      <p key={w.shopId} className="text-amber-700 text-sm">
                        {w.message} ({w.responseCount}件)
                      </p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b pb-2">
            <Button
              variant={activeTab === 'chart' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('chart')}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              チャート
            </Button>
            <Button
              variant={activeTab === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('table')}
            >
              <Table className="h-4 w-4 mr-1" />
              比較表
            </Button>
            <Button
              variant={activeTab === 'rankings' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('rankings')}
            >
              <Trophy className="h-4 w-4 mr-1" />
              ランキング
            </Button>
          </div>

          {/* Chart View */}
          {activeTab === 'chart' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">レーダーチャート比較</CardTitle>
                <CardDescription>
                  各カテゴリのスコアを視覚的に比較
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ComparisonRadarChart
                  shops={comparisonData.shops}
                  benchmark={comparisonData.benchmark}
                />
              </CardContent>
            </Card>
          )}

          {/* Table View */}
          {activeTab === 'table' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">スコア比較表</CardTitle>
                  <CardDescription>
                    カテゴリ別の詳細スコア
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ComparisonTable
                    shops={comparisonData.shops}
                    benchmark={comparisonData.benchmark}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">ギャップ分析</CardTitle>
                </CardHeader>
                <CardContent>
                  <GapInsights gaps={comparisonData.gaps} />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Rankings View */}
          {activeTab === 'rankings' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">事業所ランキング</CardTitle>
                <CardDescription>
                  カテゴリ別の順位
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RankingsView rankings={comparisonData.rankings} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
