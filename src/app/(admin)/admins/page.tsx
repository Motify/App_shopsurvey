'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Users,
  Plus,
  Loader2,
  Shield,
  Store,
  Upload,
  FileDown,
  AlertCircle,
  CheckCircle,
  X,
  Search,
} from 'lucide-react'

interface Admin {
  id: string
  name: string
  email: string
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE'
  isFullAccess: boolean
  _count: { shopAssignments: number }
  shopAssignments: Array<{ shop: { id: string; name: string } }>
}

interface CSVRow {
  name: string
  email: string
  access_level: string
  assigned_shops: string
}

interface ImportError {
  row: number
  message: string
}

interface ImportResult {
  created: number
  emailsSent: number
  errors: ImportError[]
  total: number
}

function CSVImportModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CSVRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError('')
    setResult(null)

    Papa.parse<CSVRow>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
      preview: 5,
      complete: (results) => {
        setPreview(results.data)
      },
      error: () => {
        setError('CSVファイルの読み込みに失敗しました')
      },
    })
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admins/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'インポートに失敗しました')
      }

      setResult(data)

      if (data.created > 0) {
        onSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'インポートに失敗しました')
    } finally {
      setImporting(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setPreview([])
    setResult(null)
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">CSVインポート</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {result ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {result.created > 0 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                )}
                <span className="font-medium">
                  {result.created} / {result.total} 管理者をインポートしました
                </span>
              </div>
              {result.emailsSent > 0 && (
                <p className="text-sm text-muted-foreground ml-7">
                  {result.emailsSent} 件の招待メールを送信しました
                </p>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 font-medium text-sm border-b">
                  エラー ({result.errors.length}件)
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">行</th>
                        <th className="text-left px-4 py-2 font-medium">エラー</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {result.errors.map((err, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2">{err.row > 0 ? err.row : '-'}</td>
                          <td className="px-4 py-2 text-red-600">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleReset}>
                別のファイルをインポート
              </Button>
              <Button onClick={onClose}>閉じる</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-file-input"
              />
              {file ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <Upload className="h-4 w-4" />
                    <span className="font-medium">{file.name}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    ファイルを変更
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="csv-file-input"
                  className="cursor-pointer space-y-2"
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    CSVファイルをクリックして選択
                  </p>
                </label>
              )}
            </div>

            {preview.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 font-medium text-sm border-b">
                  プレビュー (最初の5行)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">名前</th>
                        <th className="text-left px-4 py-2 font-medium">メール</th>
                        <th className="text-left px-4 py-2 font-medium">アクセスレベル</th>
                        <th className="text-left px-4 py-2 font-medium">担当店舗</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.map((row, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2">{row.name || '-'}</td>
                          <td className="px-4 py-2">{row.email || '-'}</td>
                          <td className="px-4 py-2">
                            {row.access_level === 'full' ? 'フルアクセス' : '限定アクセス'}
                          </td>
                          <td className="px-4 py-2">{row.assigned_shops || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <a
                href="/templates/admins-template.csv"
                download
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <FileDown className="h-4 w-4" />
                テンプレートをダウンロード
              </a>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  キャンセル
                </Button>
                <Button onClick={handleImport} disabled={!file || importing}>
                  {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  インポート
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type SortOption = 'name' | 'email' | 'status' | 'access'

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('name')

  useEffect(() => {
    fetchAdmins()
  }, [])

  // Filter and sort admins
  const filteredAdmins = useMemo(() => {
    let result = [...admins]

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (admin) =>
          admin.name.toLowerCase().includes(query) ||
          admin.email.toLowerCase().includes(query)
      )
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'email':
          return a.email.localeCompare(b.email)
        case 'status':
          const statusOrder = { ACTIVE: 0, PENDING: 1, INACTIVE: 2 }
          return statusOrder[a.status] - statusOrder[b.status]
        case 'access':
          // Full access first
          if (a.isFullAccess && !b.isFullAccess) return -1
          if (!a.isFullAccess && b.isFullAccess) return 1
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return result
  }, [admins, searchQuery, sortBy])

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

  const handleExportCSV = () => {
    if (admins.length === 0) return

    const csvData = admins.map((admin) => ({
      name: admin.name,
      email: admin.email,
      access_level: admin.isFullAccess ? 'full' : 'limited',
      assigned_shops: admin.isFullAccess
        ? ''
        : admin.shopAssignments.map((a) => a.shop.name).join(','),
      status: admin.status,
    }))

    const csv = Papa.unparse(csvData, {
      columns: ['name', 'email', 'access_level', 'assigned_shops', 'status'],
    })

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `admins-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Upload className="mr-2 h-4 w-4" />
            CSVインポート
          </Button>
          <Button variant="outline" onClick={handleExportCSV} disabled={admins.length === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            エクスポート
          </Button>
          <Link href="/admins/invite">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              管理者を招待
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              管理者一覧
            </CardTitle>
            {admins.length > 0 && (
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">名前順</SelectItem>
                    <SelectItem value="email">メール順</SelectItem>
                    <SelectItem value="status">ステータス順</SelectItem>
                    <SelectItem value="access">アクセスレベル順</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
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
          ) : filteredAdmins.length === 0 ? (
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">検索結果がありません</p>
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
                {filteredAdmins.map((admin) => (
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

      {showImportModal && (
        <CSVImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            fetchAdmins()
          }}
        />
      )}
    </div>
  )
}
