'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  parseMultiShopEmailCSV,
  validateEmail,
  type MultiShopEmailEntry,
  type MultiShopParseResult,
} from '@/lib/email-parser'
import {
  QrCode,
  Mail,
  Store,
  X,
  Plus,
  Loader2,
  Send,
  CheckCircle,
  AlertCircle,
  History,
  ChevronRight,
  Upload,
  FileDown,
  FileSpreadsheet,
  AlertTriangle,
  Building2,
} from 'lucide-react'

interface Shop {
  id: string
  name: string
  shopNumber: string | null
  parentId: string | null
  qrCode: string
  _count?: {
    children: number
  }
}

interface SendResult {
  sent: number
  failed: { email: string; reason: string }[]
  shopBreakdown?: { shopId: string; shopName: string; sent: number; failed: number }[]
}

interface EmailEntry {
  email: string
  source: 'manual' | 'csv'
  shopId?: string
  shopName?: string
  shopNumber?: string
}

function QRCodeTab({ shops }: { shops: Shop[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        QRコードを使ってアンケートを配布できます。事業所ページでQRコードを印刷またはダウンロードしてください。
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {shops.filter(s => !s.parentId || s._count?.children === 0).slice(0, 6).map(shop => (
          <Link key={shop.id} href={`/shops/${shop.id}`}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <QrCode className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{shop.name}</p>
                    {shop.shopNumber && (
                      <p className="text-xs text-muted-foreground">{shop.shopNumber}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="pt-4">
        <Link href="/shops">
          <Button variant="outline">
            <Store className="mr-2 h-4 w-4" />
            すべての事業所を表示
          </Button>
        </Link>
      </div>
    </div>
  )
}

interface MatchedEntry extends MultiShopEmailEntry {
  matchedShopId?: string
  matchedShopName?: string
  matchStatus: 'matched' | 'unmatched' | 'no-shop-info'
}

function CSVImportModal({
  onClose,
  onImportSingleShop,
  onImportMultiShop,
  existingEmails,
  shops,
}: {
  onClose: () => void
  onImportSingleShop: (emails: string[]) => void
  onImportMultiShop: (entries: MatchedEntry[]) => void
  existingEmails: string[]
  shops: Shop[]
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<MultiShopParseResult | null>(null)
  const [matchedEntries, setMatchedEntries] = useState<MatchedEntry[]>([])
  const [loading, setLoading] = useState(false)

  // Build lookup maps for shop matching
  const shopByNumber = new Map<string, Shop>()
  const shopByName = new Map<string, Shop>()

  for (const shop of shops) {
    if (shop.shopNumber) {
      shopByNumber.set(shop.shopNumber.toLowerCase(), shop)
    }
    shopByName.set(shop.name.toLowerCase(), shop)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setLoading(true)

    try {
      const text = await selectedFile.text()
      const result = parseMultiShopEmailCSV(text, existingEmails)
      setParseResult(result)

      // Match entries to shops
      const matched: MatchedEntry[] = result.entries.map(entry => {
        let matchedShop: Shop | undefined

        // Try to match by shop number first
        if (entry.shopNumber) {
          matchedShop = shopByNumber.get(entry.shopNumber.toLowerCase())
        }

        // Fall back to shop name
        if (!matchedShop && entry.shopName) {
          matchedShop = shopByName.get(entry.shopName.toLowerCase())
        }

        if (matchedShop) {
          return {
            ...entry,
            matchedShopId: matchedShop.id,
            matchedShopName: matchedShop.name,
            matchStatus: 'matched' as const,
          }
        } else if (entry.shopNumber || entry.shopName) {
          return {
            ...entry,
            matchStatus: 'unmatched' as const,
          }
        } else {
          return {
            ...entry,
            matchStatus: 'no-shop-info' as const,
          }
        }
      })

      setMatchedEntries(matched)
    } catch (err) {
      console.error('Failed to parse CSV:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = () => {
    if (!parseResult) return

    if (parseResult.hasShopInfo) {
      // Multi-shop mode - only import matched entries
      const validEntries = matchedEntries.filter(e => e.matchStatus === 'matched')
      if (validEntries.length > 0) {
        onImportMultiShop(validEntries)
        onClose()
      }
    } else {
      // Single-shop mode
      if (parseResult.entries.length > 0) {
        onImportSingleShop(parseResult.entries.map(e => e.email))
        onClose()
      }
    }
  }

  const handleReset = () => {
    setFile(null)
    setParseResult(null)
    setMatchedEntries([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const matchedCount = matchedEntries.filter(e => e.matchStatus === 'matched').length
  const unmatchedCount = matchedEntries.filter(e => e.matchStatus === 'unmatched').length
  const noShopInfoCount = matchedEntries.filter(e => e.matchStatus === 'no-shop-info').length

  // Group matched entries by shop for preview
  const entriesByShop = new Map<string, MatchedEntry[]>()
  matchedEntries
    .filter(e => e.matchStatus === 'matched')
    .forEach(entry => {
      const shopEntries = entriesByShop.get(entry.matchedShopId!) || []
      shopEntries.push(entry)
      entriesByShop.set(entry.matchedShopId!, shopEntries)
    })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>CSVからメールアドレスをインポート</DialogTitle>
          <DialogDescription>
            CSVファイルからメールアドレスを一括で読み込みます。
            事業所番号(shop_number)または事業所名(shop_name)を含めると複数事業所へ同時送信できます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {!file ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-email-input"
              />
              <label htmlFor="csv-email-input" className="cursor-pointer space-y-3 block">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="font-medium">CSVファイルを選択</p>
                  <p className="text-sm text-muted-foreground">
                    クリックしてファイルを選択してください
                  </p>
                </div>
              </label>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : parseResult ? (
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="font-medium">{file.name}</span>
                  {parseResult.hasShopInfo && (
                    <Badge variant="secondary">
                      <Building2 className="mr-1 h-3 w-3" />
                      複数事業所モード
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  ファイルを変更
                </Button>
              </div>

              {/* Summary */}
              <div className="flex flex-wrap gap-4 text-sm">
                {parseResult.hasShopInfo ? (
                  <>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>{matchedCount} 事業所マッチ</span>
                    </div>
                    {unmatchedCount > 0 && (
                      <div className="flex items-center gap-1 text-yellow-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span>{unmatchedCount} 事業所不明</span>
                      </div>
                    )}
                    {noShopInfoCount > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span>{noShopInfoCount} 事業所指定なし</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{parseResult.entries.length} 有効</span>
                  </div>
                )}
                {parseResult.invalid.length > 0 && (
                  <div className="flex items-center gap-1">
                    <X className="h-4 w-4 text-red-500" />
                    <span>{parseResult.invalid.length} 無効</span>
                  </div>
                )}
                {parseResult.duplicates > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>{parseResult.duplicates} 重複スキップ</span>
                  </div>
                )}
              </div>

              {/* Multi-shop info notice */}
              {parseResult.hasShopInfo && unmatchedCount > 0 && (
                <div className="p-3 bg-yellow-50 text-yellow-700 rounded-md text-sm">
                  <AlertTriangle className="inline h-4 w-4 mr-1" />
                  {unmatchedCount}件のメールアドレスは事業所が見つからないため送信されません。
                  事業所番号または事業所名を確認してください。
                </div>
              )}

              {/* Preview table */}
              <div className="border rounded-lg flex-1 overflow-y-auto min-h-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>メールアドレス</TableHead>
                      {parseResult.hasShopInfo && (
                        <TableHead>事業所</TableHead>
                      )}
                      <TableHead className="w-32">ステータス</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseResult.hasShopInfo ? (
                      <>
                        {/* Show by shop grouping */}
                        {Array.from(entriesByShop.entries()).slice(0, 3).map(([shopId, entries]) => (
                          entries.slice(0, 3).map((entry, i) => (
                            <TableRow key={`${shopId}-${i}`}>
                              <TableCell className="font-mono text-sm">{entry.email}</TableCell>
                              <TableCell>
                                <span className="text-sm">{entry.matchedShopName}</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="default" className="bg-green-500">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  マッチ
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        ))}
                        {matchedCount > 9 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                              ... 他 {matchedCount - 9} 件（{entriesByShop.size}事業所）
                            </TableCell>
                          </TableRow>
                        )}
                        {/* Show unmatched entries */}
                        {matchedEntries
                          .filter(e => e.matchStatus === 'unmatched')
                          .slice(0, 5)
                          .map((entry, i) => (
                            <TableRow key={`unmatched-${i}`}>
                              <TableCell className="font-mono text-sm">{entry.email}</TableCell>
                              <TableCell>
                                <span className="text-sm text-yellow-600">
                                  {entry.shopNumber || entry.shopName}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                  不明
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </>
                    ) : (
                      <>
                        {parseResult.entries.slice(0, 10).map((entry, i) => (
                          <TableRow key={`valid-${i}`}>
                            <TableCell className="font-mono text-sm">{entry.email}</TableCell>
                            <TableCell>
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                有効
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {parseResult.entries.length > 10 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                              ... 他 {parseResult.entries.length - 10} 件
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )}
                    {parseResult.invalid.map((item, i) => (
                      <TableRow key={`invalid-${i}`}>
                        <TableCell className="font-mono text-sm">{item.email}</TableCell>
                        {parseResult.hasShopInfo && <TableCell>-</TableCell>}
                        <TableCell>
                          <Badge variant="destructive">
                            <X className="mr-1 h-3 w-3" />
                            {item.reason}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between pt-2">
            <a
              href="/templates/survey-emails-template.csv"
              download
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              <FileDown className="h-4 w-4" />
              テンプレートをダウンロード
            </a>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              !parseResult ||
              (parseResult.hasShopInfo ? matchedCount === 0 : parseResult.entries.length === 0)
            }
          >
            {parseResult?.hasShopInfo
              ? `${matchedCount}件を${entriesByShop.size}事業所へ追加`
              : `${parseResult?.entries.length || 0}件を追加`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EmailTab({ shops }: { shops: Shop[] }) {
  const [selectedShopId, setSelectedShopId] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [emailEntries, setEmailEntries] = useState<EmailEntry[]>([])
  const [sending, setSending] = useState(false)
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 })
  const [showConfirm, setShowConfirm] = useState(false)
  const [showCSVModal, setShowCSVModal] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [error, setError] = useState('')
  const [isMultiShopMode, setIsMultiShopMode] = useState(false)

  const selectedShop = shops.find(s => s.id === selectedShopId)
  const emails = emailEntries.map(e => e.email)
  const csvCount = emailEntries.filter(e => e.source === 'csv').length
  const manualCount = emailEntries.filter(e => e.source === 'manual').length

  // Group entries by shop for multi-shop mode
  const entriesByShop = new Map<string, EmailEntry[]>()
  if (isMultiShopMode) {
    emailEntries.forEach(entry => {
      if (entry.shopId) {
        const shopEntries = entriesByShop.get(entry.shopId) || []
        shopEntries.push(entry)
        entriesByShop.set(entry.shopId, shopEntries)
      }
    })
  }

  // Build hierarchical shop options
  const buildShopOptions = useCallback(() => {
    const rootShops = shops.filter(s => !s.parentId)
    const options: { id: string; name: string; level: number }[] = []

    const addShop = (shop: Shop, level: number) => {
      options.push({ id: shop.id, name: shop.name, level })
      const children = shops.filter(s => s.parentId === shop.id)
      children.forEach(child => addShop(child, level + 1))
    }

    rootShops.forEach(shop => addShop(shop, 0))
    return options
  }, [shops])

  const shopOptions = buildShopOptions()

  const addEmail = () => {
    const trimmed = emailInput.trim()
    if (!trimmed) return

    // Handle multiple emails (comma or newline separated)
    const newEmails = trimmed
      .split(/[,\n;]/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e && validateEmail(e) && !emails.includes(e))

    if (newEmails.length > 0) {
      setEmailEntries([
        ...emailEntries,
        ...newEmails.map(email => ({ email, source: 'manual' as const })),
      ])
      setEmailInput('')
      setError('')
      // Adding manual emails switches back to single-shop mode
      if (isMultiShopMode) {
        setIsMultiShopMode(false)
      }
    } else if (trimmed && !validateEmail(trimmed)) {
      setError('無効なメールアドレス形式です')
    }
  }

  const removeEmail = (email: string) => {
    const newEntries = emailEntries.filter(e => e.email !== email)
    setEmailEntries(newEntries)
    // Check if we should exit multi-shop mode
    if (isMultiShopMode && newEntries.every(e => !e.shopId)) {
      setIsMultiShopMode(false)
    }
  }

  const handleCSVImportSingleShop = (csvEmails: string[]) => {
    setEmailEntries([
      ...emailEntries,
      ...csvEmails.map(email => ({ email, source: 'csv' as const })),
    ])
    setIsMultiShopMode(false)
  }

  const handleCSVImportMultiShop = (entries: MatchedEntry[]) => {
    setEmailEntries(
      entries.map(entry => ({
        email: entry.email,
        source: 'csv' as const,
        shopId: entry.matchedShopId,
        shopName: entry.matchedShopName,
        shopNumber: entry.shopNumber,
      }))
    )
    setIsMultiShopMode(true)
    setSelectedShopId('') // Clear single shop selection
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addEmail()
    }
  }

  const handleSend = async () => {
    if (isMultiShopMode) {
      // Multi-shop send
      if (entriesByShop.size === 0) return

      setSending(true)
      setError('')
      setSendProgress({ current: 0, total: emails.length })

      try {
        const response = await fetch('/api/survey/send-multi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entries: emailEntries.map(e => ({
              email: e.email,
              shopNumber: e.shopNumber,
              shopName: e.shopName,
            })),
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || '送信に失敗しました')
        }

        setResult(data)
        setShowConfirm(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : '送信に失敗しました')
        setShowConfirm(false)
      } finally {
        setSending(false)
      }
    } else {
      // Single-shop send
      if (!selectedShopId || emails.length === 0) return

      setSending(true)
      setError('')
      setSendProgress({ current: 0, total: emails.length })

      const method = csvCount >= manualCount ? 'csv' : 'manual'

      try {
        const response = await fetch('/api/survey/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopId: selectedShopId,
            emails,
            method,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || '送信に失敗しました')
        }

        setResult(data)
        setShowConfirm(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : '送信に失敗しました')
        setShowConfirm(false)
      } finally {
        setSending(false)
      }
    }
  }

  const handleReset = () => {
    setEmailEntries([])
    setSelectedShopId('')
    setResult(null)
    setError('')
    setSendProgress({ current: 0, total: 0 })
    setIsMultiShopMode(false)
  }

  // Batch size warnings
  const getBatchWarning = () => {
    if (emails.length > 500) {
      return {
        type: 'error' as const,
        message: '500件を超えています。複数回に分けて送信することをお勧めします。',
      }
    }
    if (emails.length > 100) {
      return {
        type: 'warning' as const,
        message: '100件以上のメールを送信します。送信に数分かかる場合があります。',
      }
    }
    return null
  }

  const batchWarning = getBatchWarning()

  const canSend = isMultiShopMode
    ? entriesByShop.size > 0
    : selectedShopId && emails.length > 0

  if (result) {
    return (
      <div className="space-y-4">
        <div className="p-6 bg-slate-50 rounded-lg text-center">
          {result.sent > 0 ? (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">送信完了</h3>
              <p className="text-muted-foreground">
                {result.sent}件のメールを送信しました
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">送信できませんでした</h3>
            </>
          )}
        </div>

        {/* Shop breakdown for multi-shop send */}
        {result.shopBreakdown && result.shopBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">事業所別内訳</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.shopBreakdown.map((shop, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{shop.shopName}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{shop.sent}件送信</Badge>
                      {shop.failed > 0 && (
                        <Badge variant="destructive">{shop.failed}件失敗</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {result.failed.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">送信失敗 ({result.failed.length}件)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {result.failed.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-mono">{f.email}</span>
                    <span className="text-red-500">{f.reason}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <Button onClick={handleReset}>新しく送信する</Button>
          <Link href="/survey/history">
            <Button variant="outline">
              <History className="mr-2 h-4 w-4" />
              送信履歴
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Multi-shop mode indicator */}
      {isMultiShopMode && (
        <div className="p-3 bg-blue-50 text-blue-700 rounded-md text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4 flex-shrink-0" />
          <span>
            複数事業所モード: {entriesByShop.size}事業所へ{emails.length}件のメールを送信します
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-blue-700 hover:text-blue-900"
            onClick={() => {
              setIsMultiShopMode(false)
              setEmailEntries([])
            }}
          >
            クリア
          </Button>
        </div>
      )}

      {/* Shop selection - only show in single-shop mode */}
      {!isMultiShopMode && (
        <div className="space-y-2">
          <Label>対象事業所 *</Label>
          <Select value={selectedShopId} onValueChange={setSelectedShopId}>
            <SelectTrigger>
              <SelectValue placeholder="事業所を選択してください" />
            </SelectTrigger>
            <SelectContent>
              {shopOptions.map(option => (
                <SelectItem key={option.id} value={option.id}>
                  <span style={{ paddingLeft: `${option.level * 16}px` }}>
                    {option.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            複数事業所に一括送信する場合は、CSVに事業所番号または事業所名を含めてインポートしてください
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>メールアドレス</Label>
          <div className="flex gap-2">
            <a
              href="/templates/survey-emails-template.csv"
              download
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <FileDown className="h-3 w-3" />
              テンプレート
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCSVModal(true)}
            >
              <Upload className="mr-1 h-3 w-3" />
              CSVインポート
            </Button>
          </div>
        </div>
        {!isMultiShopMode && (
          <>
            <div className="flex gap-2">
              <Input
                placeholder="example@email.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={addEmail}
              />
              <Button type="button" variant="outline" onClick={addEmail}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              カンマ、セミコロン、または改行で複数のメールアドレスを追加できます
            </p>
          </>
        )}
      </div>

      {emailEntries.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>送信リスト</Label>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{emailEntries.length}件</span>
              {isMultiShopMode && (
                <span className="text-xs">
                  ({entriesByShop.size}事業所)
                </span>
              )}
              {!isMultiShopMode && csvCount > 0 && manualCount > 0 && (
                <span className="text-xs">
                  (CSV: {csvCount}, 手動: {manualCount})
                </span>
              )}
            </div>
          </div>
          <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
            {isMultiShopMode ? (
              // Group by shop in multi-shop mode
              <div className="space-y-3">
                {Array.from(entriesByShop.entries()).map(([shopId, entries]) => {
                  const shop = shops.find(s => s.id === shopId)
                  return (
                    <div key={shopId}>
                      <div className="flex items-center gap-2 text-sm font-medium mb-1">
                        <Store className="h-3 w-3" />
                        {shop?.name}
                        <Badge variant="secondary" className="text-xs">
                          {entries.length}件
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 pl-5">
                        {entries.map(entry => (
                          <div
                            key={entry.email}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-sm bg-blue-50"
                          >
                            <span className="font-mono text-xs">{entry.email}</span>
                            <button
                              onClick={() => removeEmail(entry.email)}
                              className="p-0.5 hover:bg-blue-100 rounded"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              // Flat list in single-shop mode
              <div className="flex flex-wrap gap-2">
                {emailEntries.map(entry => (
                  <div
                    key={entry.email}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-md text-sm',
                      entry.source === 'csv' ? 'bg-blue-50' : 'bg-slate-100'
                    )}
                  >
                    <span className="font-mono text-xs">{entry.email}</span>
                    {entry.source === 'csv' && (
                      <FileSpreadsheet className="h-3 w-3 text-blue-500" />
                    )}
                    <button
                      onClick={() => removeEmail(entry.email)}
                      className="p-0.5 hover:bg-slate-200 rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {batchWarning && (
        <div
          className={cn(
            'p-3 rounded-md text-sm flex items-center gap-2',
            batchWarning.type === 'error'
              ? 'bg-red-50 text-red-700'
              : 'bg-yellow-50 text-yellow-700'
          )}
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {batchWarning.message}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={() => setShowConfirm(true)}
          disabled={!canSend}
        >
          <Send className="mr-2 h-4 w-4" />
          アンケートを送信
        </Button>
        <Link href="/survey/history">
          <Button variant="outline">
            <History className="mr-2 h-4 w-4" />
            送信履歴
          </Button>
        </Link>
      </div>

      {/* CSV Import Modal */}
      {showCSVModal && (
        <CSVImportModal
          onClose={() => setShowCSVModal(false)}
          onImportSingleShop={handleCSVImportSingleShop}
          onImportMultiShop={handleCSVImportMultiShop}
          existingEmails={emails}
          shops={shops}
        />
      )}

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>送信確認</DialogTitle>
            <DialogDescription>
              以下の内容でアンケートを送信します。よろしいですか？
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {isMultiShopMode ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">送信先事業所</span>
                  <span className="font-medium">{entriesByShop.size}事業所</span>
                </div>
                <div className="text-sm space-y-1 max-h-32 overflow-y-auto">
                  {Array.from(entriesByShop.entries()).map(([shopId, entries]) => {
                    const shop = shops.find(s => s.id === shopId)
                    return (
                      <div key={shopId} className="flex items-center justify-between text-muted-foreground">
                        <span>{shop?.name}</span>
                        <span>{entries.length}件</span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">事業所</span>
                <span className="font-medium">{selectedShop?.name}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">送信先合計</span>
              <span className="font-medium">{emails.length}件</span>
            </div>
            {batchWarning && (
              <div
                className={cn(
                  'p-2 rounded-md text-xs',
                  batchWarning.type === 'error'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-yellow-50 text-yellow-700'
                )}
              >
                {batchWarning.message}
              </div>
            )}
          </div>

          {sending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>送信中...</span>
                <span>
                  {sendProgress.current} / {sendProgress.total}
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${(sendProgress.current / sendProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={sending}
            >
              キャンセル
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  送信中...
                </>
              ) : (
                '送信する'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SurveyPage() {
  const [activeTab, setActiveTab] = useState<'qr' | 'email'>('email')
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchShops()
  }, [])

  const fetchShops = async () => {
    try {
      const response = await fetch('/api/shops')
      if (response.ok) {
        const data = await response.json()
        setShops(data)
      }
    } catch (err) {
      console.error('Failed to fetch shops:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">アンケート配布</h1>
          <p className="text-muted-foreground">
            QRコードまたはメールでアンケートを配布します
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-1 border-b -mx-6 px-6 pb-4">
            <button
              onClick={() => setActiveTab('qr')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                activeTab === 'qr'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-slate-100'
              )}
            >
              <QrCode className="h-4 w-4" />
              QRコード
            </button>
            <button
              onClick={() => setActiveTab('email')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                activeTab === 'email'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-slate-100'
              )}
            >
              <Mail className="h-4 w-4" />
              メール
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeTab === 'qr' ? (
            <QRCodeTab shops={shops} />
          ) : (
            <EmailTab shops={shops} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
