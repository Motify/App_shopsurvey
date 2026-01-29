'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  SortableTree,
  TreeNode,
  SortOption,
  useTreeContext,
} from '@/components/ui/sortable-tree'
import {
  Plus,
  Store,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  MapPin,
  MessageSquare,
  Loader2,
  QrCode,
  Download,
  Printer,
  X,
  Copy,
  Check,
  Upload,
  FileDown,
  AlertCircle,
  CheckCircle,
  GripVertical,
  Search,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import Papa from 'papaparse'

interface Shop {
  id: string
  name: string
  shopNumber: string | null
  address: string | null
  qrCode: string
  status: 'ACTIVE' | 'INACTIVE'
  parentId: string | null
  _count: {
    responses: number
    children: number
  }
  parent: {
    id: string
    name: string
  } | null
}

// Sort options for shops
const shopSortOptions: SortOption<Shop>[] = [
  {
    label: '名前順',
    value: 'name',
    compareFn: (a, b) => a.name.localeCompare(b.name),
  },
  {
    label: '店舗番号順',
    value: 'shopNumber',
    compareFn: (a, b) => {
      const aNum = a.shopNumber || ''
      const bNum = b.shopNumber || ''
      return aNum.localeCompare(bNum)
    },
  },
  {
    label: '回答数順',
    value: 'responses',
    compareFn: (a, b) => {
      const aCount = a._count?.responses || 0
      const bCount = b._count?.responses || 0
      return bCount - aCount // Descending
    },
  },
]

function QRPreviewModal({
  shop,
  onClose,
}: {
  shop: Shop
  onClose: () => void
}) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const surveyUrl = `${appUrl}/survey/${shop.qrCode}`

  useEffect(() => {
    generateQRCode()
  }, [shop.qrCode])

  const generateQRCode = async () => {
    try {
      const QRCode = (await import('qrcode')).default
      const dataUrl = await QRCode.toDataURL(surveyUrl, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
      setQrCodeDataUrl(dataUrl)
    } catch (err) {
      console.error('Failed to generate QR code:', err)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(surveyUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">{shop.name}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {qrCodeDataUrl ? (
          <div className="flex justify-center mb-4">
            <img
              src={qrCodeDataUrl}
              alt="QR Code"
              className="w-[200px] h-[200px] border rounded-lg"
            />
          </div>
        ) : (
          <div className="flex justify-center items-center w-[200px] h-[200px] mx-auto mb-4 border rounded-lg bg-slate-50">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        <div className="flex items-center gap-2 mb-4">
          <input
            readOnly
            value={surveyUrl}
            className="flex-1 text-xs font-mono p-2 border rounded bg-slate-50 truncate"
          />
          <button
            onClick={handleCopy}
            className="p-2 border rounded hover:bg-slate-50"
            title="Copy URL"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/shops/${shop.id}/qrcode`, '_blank')}
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/shops/${shop.id}/qr-print`, '_blank')}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>
    </div>
  )
}

interface ImportError {
  row: number
  message: string
}

interface ImportResult {
  created: number
  errors: ImportError[]
  total: number
}

interface CSVPreviewRow {
  shop_number: string
  name: string
  parent_name: string
  address: string
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
  const [preview, setPreview] = useState<CSVPreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError('')
    setResult(null)

    Papa.parse<CSVPreviewRow>(selectedFile, {
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

      const response = await fetch('/api/shops/import', {
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
                  {result.created} / {result.total} 店舗をインポートしました
                </span>
              </div>
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
                          <td className="px-4 py-2">{err.row}</td>
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
                        <th className="text-left px-4 py-2 font-medium">店舗番号</th>
                        <th className="text-left px-4 py-2 font-medium">店舗名</th>
                        <th className="text-left px-4 py-2 font-medium">親店舗</th>
                        <th className="text-left px-4 py-2 font-medium">住所</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.map((row, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2">{row.shop_number || '-'}</td>
                          <td className="px-4 py-2">{row.name || '-'}</td>
                          <td className="px-4 py-2">{row.parent_name || '-'}</td>
                          <td className="px-4 py-2">{row.address || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <a
                href="/templates/shops-template.csv"
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

// Custom Shop Tree Item Renderer
function ShopTreeItemContent({
  node,
  dragHandleProps,
  onShowQR,
}: {
  node: TreeNode<Shop>
  dragHandleProps: object
  onShowQR: (shop: Shop) => void
}) {
  const { expandedIds, selectedIds, toggleExpand, toggleSelect, searchQuery } =
    useTreeContext()

  const hasChildren = node.children.length > 0
  const isExpanded = expandedIds.has(node.id) || !!searchQuery
  const isSelected = selectedIds.has(node.id)

  return (
    <div
      className={cn(
        'flex items-center gap-2 py-2 px-3 rounded-md hover:bg-slate-100 transition-colors',
        node.status === 'INACTIVE' && 'opacity-60',
        isSelected && 'bg-slate-100'
      )}
      style={{ paddingLeft: `${node.level * 24 + 12}px` }}
    >
      <div {...dragHandleProps}>
        <GripVertical className="h-4 w-4 text-slate-400" />
      </div>

      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => toggleSelect(node.id)}
        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
      />

      {hasChildren ? (
        <button
          onClick={() => toggleExpand(node.id)}
          className="p-0.5 hover:bg-slate-200 rounded"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
        </button>
      ) : (
        <span className="w-5" />
      )}

      {hasChildren ? (
        <FolderOpen className="h-4 w-4 text-amber-500" />
      ) : (
        <Store className="h-4 w-4 text-slate-500" />
      )}

      <Link
        href={`/shops/${node.id}`}
        className="flex-1 flex items-center gap-3 min-w-0"
      >
        {node.shopNumber && (
          <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
            {node.shopNumber}
          </span>
        )}
        <span className="font-medium text-slate-900 truncate hover:text-primary">
          {node.name}
        </span>
        {node.address && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500 truncate">
            <MapPin className="h-3 w-3" />
            {node.address}
          </span>
        )}
      </Link>

      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.preventDefault()
            onShowQR(node)
          }}
          className="p-1.5 hover:bg-slate-200 rounded"
          title="Show QR Code"
        >
          <QrCode className="h-4 w-4 text-slate-500" />
        </button>
        <Badge
          variant={node.status === 'ACTIVE' ? 'default' : 'secondary'}
          className="text-xs"
        >
          {node.status}
        </Badge>
        <span className="flex items-center gap-1 text-xs text-slate-500 min-w-[60px]">
          <MessageSquare className="h-3 w-3" />
          {node._count.responses}
        </span>
      </div>
    </div>
  )
}

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewShop, setPreviewShop] = useState<Shop | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortValue, setSortValue] = useState('name')

  useEffect(() => {
    fetchShops()
  }, [])

  const fetchShops = async () => {
    try {
      const response = await fetch('/api/shops')
      if (!response.ok) {
        throw new Error('Failed to fetch shops')
      }
      const data = await response.json()
      setShops(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleReorder = useCallback(
    async (itemId: string, newParentId: string | null, newIndex: number) => {
      // Optimistically update the UI
      const item = shops.find((s) => s.id === itemId)
      if (!item) return

      // Update parent on the server
      try {
        const response = await fetch(`/api/shops/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: newParentId }),
        })

        if (!response.ok) {
          throw new Error('Failed to update shop')
        }

        // Refresh shops to get the updated tree
        fetchShops()
      } catch (err) {
        console.error('Failed to reorder:', err)
        // Refresh to restore original state
        fetchShops()
      }
    },
    [shops]
  )

  const selectAll = () => {
    if (selectedIds.size === shops.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(shops.map((s) => s.id)))
    }
  }

  const handleBulkDownload = useCallback(async () => {
    if (selectedIds.size === 0) return

    setDownloading(true)
    try {
      const JSZip = (await import('jszip')).default
      const { saveAs } = await import('file-saver')
      const QRCode = (await import('qrcode')).default

      const zip = new JSZip()
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      const selectedShops = shops.filter((s) => selectedIds.has(s.id))

      for (const shop of selectedShops) {
        const surveyUrl = `${appUrl}/survey/${shop.qrCode}`
        const dataUrl = await QRCode.toDataURL(surveyUrl, {
          width: 400,
          margin: 2,
          errorCorrectionLevel: 'M',
        })
        const base64Data = dataUrl.split(',')[1]
        const filename = `${shop.name.replace(/[^a-zA-Z0-9-_]/g, '_')}-qr.png`
        zip.file(filename, base64Data, { base64: true })
      }

      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, 'shop-qrcodes.zip')
    } catch (err) {
      console.error('Failed to download QR codes:', err)
    } finally {
      setDownloading(false)
    }
  }, [selectedIds, shops])

  const handleBulkPrint = () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds).join(',')
    window.open(`/shops/bulk-print?ids=${ids}`, '_blank')
  }

  const handleExportCSV = useCallback(() => {
    if (shops.length === 0) return

    const shopIdToName = new Map<string, string>()
    shops.forEach((shop) => shopIdToName.set(shop.id, shop.name))

    const csvData = shops.map((shop) => ({
      shop_number: shop.shopNumber || '',
      name: shop.name,
      parent_name: shop.parentId ? shopIdToName.get(shop.parentId) || '' : '',
      address: shop.address || '',
    }))

    const csv = Papa.unparse(csvData)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'shops-export.csv'
    link.click()
    URL.revokeObjectURL(url)
  }, [shops])

  const renderShopItem = useCallback(
    (node: TreeNode<Shop>, dragHandleProps: object) => (
      <ShopTreeItemContent
        node={node}
        dragHandleProps={dragHandleProps}
        onShowQR={setPreviewShop}
      />
    ),
    []
  )

  const totalShops = shops.length
  const activeShops = shops.filter((s) => s.status === 'ACTIVE').length
  const totalResponses = shops.reduce((acc, s) => acc + s._count.responses, 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Shops</h1>
          <p className="text-muted-foreground">
            Manage your shop locations and view survey responses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Upload className="mr-2 h-4 w-4" />
            CSVインポート
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <FileDown className="mr-2 h-4 w-4" />
            エクスポート
          </Button>
          <Link href="/shops/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Shop
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shops</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalShops}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Shops</CardTitle>
            <Store className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeShops}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResponses}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Shop Hierarchy</CardTitle>
            <div className="flex items-center gap-4">
              {shops.length > 0 && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Select value={sortValue} onValueChange={setSortValue}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {shopSortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 border-l pl-4">
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDownload}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Download ZIP
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleBulkPrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print All
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : shops.length === 0 ? (
            <div className="text-center py-8">
              <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No shops yet</p>
              <Link href="/shops/new">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Shop
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3 pb-3 border-b">
                <input
                  type="checkbox"
                  checked={selectedIds.size === shops.length && shops.length > 0}
                  onChange={selectAll}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-muted-foreground">
                  Select all shops
                </span>
              </div>
              <SortableTree
                items={shops}
                sortOptions={shopSortOptions}
                defaultSortValue="name"
                enableSearch={true}
                enableSort={true}
                enableDragDrop={true}
                enableSelection={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onReorder={handleReorder}
                renderItem={renderShopItem}
                emptyMessage="店舗がありません"
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                sortValue={sortValue}
                onSortChange={setSortValue}
                hideControls={true}
              />
            </>
          )}
        </CardContent>
      </Card>

      {previewShop && (
        <QRPreviewModal
          shop={previewShop}
          onClose={() => setPreviewShop(null)}
        />
      )}

      {showImportModal && (
        <CSVImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            fetchShops()
          }}
        />
      )}
    </div>
  )
}
