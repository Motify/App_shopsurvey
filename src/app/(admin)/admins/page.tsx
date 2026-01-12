'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Users, Plus, Loader2, Shield, Store } from 'lucide-react'

interface Admin {
  id: string
  name: string
  email: string
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE'
  isFullAccess: boolean
  _count: { shopAssignments: number }
  shopAssignments: Array<{ shop: { id: string; name: string } }>
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAdmins()
  }, [])

  const fetchAdmins = async () => {
    try {
      const response = await fetch('/api/admins')
      if (response.status === 403) {
        setError('このページにアクセスする権限がありません')
        return
      }
      if (!response.ok) throw new Error('Failed to fetch')
      setAdmins(await response.json())
    } catch (err) {
      setError('管理者の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">有効</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">招待中</Badge>
      case 'INACTIVE':
        return <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100">無効</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
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
          <CardContent className="py-12 text-center text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">管理者</h1>
          <p className="text-muted-foreground">管理者の一覧と権限設定</p>
        </div>
        <Link href="/admins/invite">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            管理者を招待
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            管理者一覧
          </CardTitle>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">管理者がいません</p>
              <Link href="/admins/invite">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  管理者を招待
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名前</TableHead>
                  <TableHead>メール</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>アクセスレベル</TableHead>
                  <TableHead>担当店舗</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.name}</TableCell>
                    <TableCell className="text-muted-foreground">{admin.email}</TableCell>
                    <TableCell>{getStatusBadge(admin.status)}</TableCell>
                    <TableCell>
                      {admin.isFullAccess ? (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                          <Shield className="mr-1 h-3 w-3" />
                          フルアクセス
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Store className="mr-1 h-3 w-3" />
                          限定アクセス
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {admin.isFullAccess ? (
                        <span className="text-sm text-muted-foreground">全店舗</span>
                      ) : (
                        <span className="text-sm">{admin._count.shopAssignments} 店舗</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admins/${admin.id}`}>
                        <Button variant="outline" size="sm">
                          編集
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
