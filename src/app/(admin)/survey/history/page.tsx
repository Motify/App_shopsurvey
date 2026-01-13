'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Mail,
  Loader2,
  Calendar,
  Store,
  Users,
  Eye,
  CheckCircle,
  ChevronRight,
  FileSpreadsheet,
  Keyboard,
} from 'lucide-react'

interface SurveyBatch {
  id: string
  shopId: string
  shopName: string
  shopNumber: string | null
  sentAt: string
  totalSent: number
  method: string
  opened: number
  completed: number
  openRate: number
  completionRate: number
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getCompletionBadgeVariant(rate: number): 'default' | 'secondary' | 'destructive' {
  if (rate >= 50) return 'default'
  if (rate >= 25) return 'secondary'
  return 'destructive'
}

export default function SurveyHistoryPage() {
  const [batches, setBatches] = useState<SurveyBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/survey/history')
      if (!response.ok) {
        throw new Error('Failed to fetch history')
      }
      const data = await response.json()
      setBatches(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Calculate totals
  const totalSent = batches.reduce((acc, b) => acc + b.totalSent, 0)
  const totalOpened = batches.reduce((acc, b) => acc + b.opened, 0)
  const totalCompleted = batches.reduce((acc, b) => acc + b.completed, 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/survey">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">送信履歴</h1>
            <p className="text-muted-foreground">
              メールで送信したアンケートの履歴と回答状況
            </p>
          </div>
        </div>
        <Link href="/survey">
          <Button>
            <Mail className="mr-2 h-4 w-4" />
            新規送信
          </Button>
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">送信総数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSent}</div>
            <p className="text-xs text-muted-foreground">
              {batches.length}回の送信
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">開封</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOpened}</div>
            <p className="text-xs text-muted-foreground">
              {totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">回答完了</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompleted}</div>
            <p className="text-xs text-muted-foreground">
              {totalSent > 0 ? Math.round((totalCompleted / totalSent) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>送信履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : batches.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                まだアンケートを送信していません
              </p>
              <Link href="/survey">
                <Button variant="outline">
                  <Mail className="mr-2 h-4 w-4" />
                  アンケートを送信する
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>送信日時</TableHead>
                  <TableHead>店舗</TableHead>
                  <TableHead className="text-center">方法</TableHead>
                  <TableHead className="text-center">送信数</TableHead>
                  <TableHead className="text-center">開封</TableHead>
                  <TableHead className="text-center">回答</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map(batch => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(batch.sentAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{batch.shopName}</span>
                        {batch.shopNumber && (
                          <span className="text-xs text-muted-foreground">
                            ({batch.shopNumber})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={batch.method === 'csv' ? 'default' : 'secondary'}>
                        {batch.method === 'csv' ? (
                          <><FileSpreadsheet className="h-3 w-3 mr-1" />CSV</>
                        ) : (
                          <><Keyboard className="h-3 w-3 mr-1" />手動</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium">{batch.totalSent}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-medium">{batch.opened}</span>
                        <span className="text-xs text-muted-foreground">
                          ({batch.openRate}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant={getCompletionBadgeVariant(batch.completionRate)}>
                          {batch.completed}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({batch.completionRate}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/survey/history/${batch.id}`}>
                        <Button variant="ghost" size="sm">
                          詳細
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
