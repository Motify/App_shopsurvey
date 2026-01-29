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
  Store,
  Users,
  Eye,
  CheckCircle,
  Clock,
  Send,
  RefreshCw,
} from 'lucide-react'

interface Invite {
  id: string
  email: string
  sentAt: string
  openedAt: string | null
  completedAt: string | null
  status: 'sent' | 'opened' | 'completed'
}

interface BatchDetail {
  id: string
  shopId: string
  shopName: string
  shopNumber: string | null
  sentAt: string
  totalSent: number
  invites: Invite[]
  stats: {
    sent: number
    opened: number
    completed: number
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusBadge(status: 'sent' | 'opened' | 'completed') {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="mr-1 h-3 w-3" />
          回答済み
        </Badge>
      )
    case 'opened':
      return (
        <Badge variant="secondary">
          <Eye className="mr-1 h-3 w-3" />
          開封
        </Badge>
      )
    case 'sent':
      return (
        <Badge variant="outline">
          <Clock className="mr-1 h-3 w-3" />
          未開封
        </Badge>
      )
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (local.length <= 3) {
    return `${local[0]}***@${domain}`
  }
  return `${local.slice(0, 3)}***@${domain}`
}

export default function BatchDetailPage({
  params,
}: {
  params: { batchId: string }
}) {
  const { batchId } = params
  const [batch, setBatch] = useState<BatchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resending, setResending] = useState(false)

  useEffect(() => {
    fetchBatchDetail()
  }, [batchId])

  const fetchBatchDetail = async () => {
    try {
      const response = await fetch(`/api/survey/history/${batchId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch batch detail')
      }
      const data = await response.json()
      setBatch(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleResendIncomplete = async () => {
    if (!batch) return

    const incompleteEmails = batch.invites
      .filter(i => !i.completedAt)
      .map(i => i.email)

    if (incompleteEmails.length === 0) {
      alert('すべての回答が完了しています')
      return
    }

    if (!confirm(`${incompleteEmails.length}件の未完了アドレスに再送信しますか？`)) {
      return
    }

    setResending(true)
    try {
      const response = await fetch('/api/survey/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: batch.shopId,
          emails: incompleteEmails,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to resend')
      }

      const result = await response.json()
      alert(`${result.sent}件のメールを再送信しました`)
    } catch (err) {
      alert('再送信に失敗しました')
    } finally {
      setResending(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !batch) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/survey/history">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">エラー</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {error || 'データが見つかりません'}
          </CardContent>
        </Card>
      </div>
    )
  }

  const incompleteCount = batch.stats.sent - batch.stats.completed

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/survey/history">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">送信詳細</h1>
            <p className="text-muted-foreground">
              {formatDate(batch.sentAt)} に送信
            </p>
          </div>
        </div>
        {incompleteCount > 0 && (
          <Button
            onClick={handleResendIncomplete}
            disabled={resending}
            variant="outline"
          >
            {resending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            未完了に再送信 ({incompleteCount}件)
          </Button>
        )}
      </div>

      {/* Batch info */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 rounded-lg">
              <Store className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <p className="font-semibold text-lg">{batch.shopName}</p>
              {batch.shopNumber && (
                <p className="text-sm text-muted-foreground">{batch.shopNumber}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">送信</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batch.stats.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">開封</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batch.stats.opened}</div>
            <p className="text-xs text-muted-foreground">
              {batch.stats.sent > 0
                ? Math.round((batch.stats.opened / batch.stats.sent) * 100)
                : 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">回答完了</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batch.stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              {batch.stats.sent > 0
                ? Math.round((batch.stats.completed / batch.stats.sent) * 100)
                : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invite list */}
      <Card>
        <CardHeader>
          <CardTitle>送信先一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>メールアドレス</TableHead>
                <TableHead>送信日時</TableHead>
                <TableHead>開封日時</TableHead>
                <TableHead>回答日時</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.invites.map(invite => (
                <TableRow key={invite.id}>
                  <TableCell>
                    <span className="font-mono text-sm">
                      {maskEmail(invite.email)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(invite.sentAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(invite.openedAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(invite.completedAt)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(invite.status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
