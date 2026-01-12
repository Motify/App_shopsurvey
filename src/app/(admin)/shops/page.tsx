'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Shop {
  id: string
  name: string
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

interface TreeNode extends Shop {
  children: TreeNode[]
  level: number
}

function buildTree(shops: Shop[]): TreeNode[] {
  const shopMap = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  shops.forEach((shop) => {
    shopMap.set(shop.id, { ...shop, children: [], level: 0 })
  })

  shops.forEach((shop) => {
    const node = shopMap.get(shop.id)!
    if (shop.parentId && shopMap.has(shop.parentId)) {
      const parent = shopMap.get(shop.parentId)!
      node.level = parent.level + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    nodes.forEach((node) => sortNodes(node.children))
  }
  sortNodes(roots)

  return roots
}

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

function ShopTreeItem({
  shop,
  expandedIds,
  toggleExpand,
  selectedIds,
  toggleSelect,
  onShowQR,
}: {
  shop: TreeNode
  expandedIds: Set<string>
  toggleExpand: (id: string) => void
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
  onShowQR: (shop: Shop) => void
}) {
  const hasChildren = shop.children.length > 0
  const isExpanded = expandedIds.has(shop.id)
  const isSelected = selectedIds.has(shop.id)

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-2 px-3 rounded-md hover:bg-slate-100 transition-colors',
          shop.status === 'INACTIVE' && 'opacity-60',
          isSelected && 'bg-slate-100'
        )}
        style={{ paddingLeft: `${shop.level * 24 + 12}px` }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelect(shop.id)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />

        {hasChildren ? (
          <button
            onClick={() => toggleExpand(shop.id)}
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
          href={`/shops/${shop.id}`}
          className="flex-1 flex items-center gap-3 min-w-0"
        >
          <span className="font-medium text-slate-900 truncate hover:text-primary">
            {shop.name}
          </span>
          {shop.address && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500 truncate">
              <MapPin className="h-3 w-3" />
              {shop.address}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.preventDefault()
              onShowQR(shop)
            }}
            className="p-1.5 hover:bg-slate-200 rounded"
            title="Show QR Code"
          >
            <QrCode className="h-4 w-4 text-slate-500" />
          </button>
          <Badge
            variant={shop.status === 'ACTIVE' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {shop.status}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-slate-500 min-w-[60px]">
            <MessageSquare className="h-3 w-3" />
            {shop._count.responses}
          </span>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {shop.children.map((child) => (
            <ShopTreeItem
              key={child.id}
              shop={child}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              selectedIds={selectedIds}
              toggleSelect={toggleSelect}
              onShowQR={onShowQR}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewShop, setPreviewShop] = useState<Shop | null>(null)
  const [downloading, setDownloading] = useState(false)

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

      const parentsWithChildren = data
        .filter((s: Shop) => s._count.children > 0)
        .map((s: Shop) => s.id)
      setExpandedIds(new Set(parentsWithChildren))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

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
        // Use toDataURL (browser-compatible) instead of toBuffer
        const dataUrl = await QRCode.toDataURL(surveyUrl, {
          width: 400,
          margin: 2,
          errorCorrectionLevel: 'M',
        })
        // Convert data URL to blob
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

  const tree = buildTree(shops)

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
        <Link href="/shops/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Shop
          </Button>
        </Link>
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
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
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
              <div className="space-y-1">
                {tree.map((shop) => (
                  <ShopTreeItem
                    key={shop.id}
                    shop={shop}
                    expandedIds={expandedIds}
                    toggleExpand={toggleExpand}
                    selectedIds={selectedIds}
                    toggleSelect={toggleSelect}
                    onShowQR={setPreviewShop}
                  />
                ))}
              </div>
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
    </div>
  )
}
