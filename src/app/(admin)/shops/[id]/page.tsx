'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Loader2,
  QrCode,
  Store,
  MessageSquare,
  AlertTriangle,
  Download,
  Printer,
  Copy,
  Check,
} from 'lucide-react'

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
  children: {
    id: string
    name: string
    status: 'ACTIVE' | 'INACTIVE'
  }[]
}

interface ShopOption {
  id: string
  name: string
  parentId: string | null
}

export default function EditShopPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const router = useRouter()

  const [shop, setShop] = useState<Shop | null>(null)
  const [allShops, setAllShops] = useState<ShopOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)

  const [name, setName] = useState('')
  const [shopNumber, setShopNumber] = useState('')
  const [parentId, setParentId] = useState<string>('none')
  const [address, setAddress] = useState('')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  useEffect(() => {
    Promise.all([fetchShop(), fetchAllShops()])
  }, [id])

  useEffect(() => {
    if (shop?.qrCode) {
      generateQRCode(shop.qrCode)
    }
  }, [shop?.qrCode])

  const generateQRCode = async (qrCode: string) => {
    try {
      const QRCode = (await import('qrcode')).default
      const surveyUrl = `${appUrl}/survey/${qrCode}`
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

  const getSurveyUrl = () => {
    if (!shop) return ''
    return `${appUrl}/survey/${shop.qrCode}`
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(getSurveyUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDownloadQR = () => {
    window.open(`/api/shops/${id}/qrcode`, '_blank')
  }

  const handlePrintQR = () => {
    window.open(`/shops/${id}/qr-print`, '_blank')
  }

  const fetchShop = async () => {
    try {
      const response = await fetch(`/api/shops/${id}`)
      if (!response.ok) {
        throw new Error('Shop not found')
      }
      const data = await response.json()
      setShop(data)
      setName(data.name)
      setShopNumber(data.shopNumber || '')
      setParentId(data.parentId || 'none')
      setAddress(data.address || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllShops = async () => {
    try {
      const response = await fetch('/api/shops')
      if (response.ok) {
        const data = await response.json()
        setAllShops(data)
      }
    } catch (err) {
      console.error('Failed to fetch shops:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const response = await fetch(`/api/shops/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          shopNumber: shopNumber || null,
          parentId: parentId === 'none' ? null : parentId,
          address: address || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update shop')
      }

      router.push('/shops')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/shops/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INACTIVE' }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to deactivate shop')
      }

      router.push('/shops')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
      setShowDeactivateConfirm(false)
    }
  }

  const handleActivate = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/shops/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to activate shop')
      }

      setShop({ ...shop!, status: 'ACTIVE' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  // Get valid parent options (exclude self and descendants)
  const getValidParentOptions = (): ShopOption[] => {
    if (!shop) return []

    // Get all descendants of current shop
    const descendants = new Set<string>()
    const addDescendants = (parentId: string) => {
      allShops
        .filter((s) => s.parentId === parentId)
        .forEach((child) => {
          descendants.add(child.id)
          addDescendants(child.id)
        })
    }
    addDescendants(id)

    // Filter out self and descendants
    return allShops.filter((s) => s.id !== id && !descendants.has(s.id))
  }

  const getShopDisplayName = (shopItem: ShopOption): string => {
    const parts: string[] = [shopItem.name]
    let current = shopItem
    while (current.parentId) {
      const parent = allShops.find((s) => s.id === current.parentId)
      if (parent) {
        parts.unshift(parent.name)
        current = parent
      } else {
        break
      }
    }
    return parts.join(' > ')
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || 'Shop not found'}</p>
          <Link href="/shops">
            <Button variant="outline">Back to Shops</Button>
          </Link>
        </div>
      </div>
    )
  }

  const validParentOptions = getValidParentOptions()

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/shops"
          className="flex items-center text-sm text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Shops
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{shop.name}</h1>
          <Badge variant={shop.status === 'ACTIVE' ? 'default' : 'secondary'}>
            {shop.status}
          </Badge>
        </div>
        <p className="text-muted-foreground">Edit shop details and settings</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shop Details</CardTitle>
              <CardDescription>Update the shop information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Shop Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shopNumber">事業所番号</Label>
                  <Input
                    id="shopNumber"
                    value={shopNumber}
                    onChange={(e) => setShopNumber(e.target.value)}
                    disabled={saving}
                    placeholder="例: T001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parentId">Parent Shop</Label>
                  <Select
                    value={parentId}
                    onValueChange={setParentId}
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None (top level)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (top level)</SelectItem>
                      {validParentOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {getShopDisplayName(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="submit" disabled={saving || !name}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                  <Link href="/shops">
                    <Button type="button" variant="outline" disabled={saving}>
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>

          {shop.children.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Child Shops</CardTitle>
                <CardDescription>
                  Shops nested under this location
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {shop.children.map((child) => (
                    <Link
                      key={child.id}
                      href={`/shops/${child.id}`}
                      className="flex items-center justify-between p-3 rounded-md border hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-slate-500" />
                        <span className="font-medium">{child.name}</span>
                      </div>
                      <Badge
                        variant={
                          child.status === 'ACTIVE' ? 'default' : 'secondary'
                        }
                      >
                        {child.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {qrCodeDataUrl ? (
                  <div className="flex justify-center">
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code"
                      className="w-[200px] h-[200px] border rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="flex justify-center items-center w-[200px] h-[200px] mx-auto border rounded-lg bg-slate-50">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={getSurveyUrl()}
                      className="text-xs font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyUrl}
                      title="Copy URL"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadQR}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrintQR}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Total Responses
                  </span>
                  <span className="font-medium">{shop._count.responses}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Child Shops
                  </span>
                  <span className="font-medium">{shop._count.children}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              {shop.status === 'ACTIVE' ? (
                <>
                  {!showDeactivateConfirm ? (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => setShowDeactivateConfirm(true)}
                      disabled={saving || shop._count.children > 0}
                    >
                      Deactivate Shop
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Are you sure? This shop will no longer accept survey
                        responses.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeactivate}
                          disabled={saving}
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Confirm'
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDeactivateConfirm(false)}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {shop._count.children > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Cannot deactivate a shop with child shops. Reassign or
                      remove children first.
                    </p>
                  )}
                </>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleActivate}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Reactivate Shop
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
