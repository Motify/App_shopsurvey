'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2 } from 'lucide-react'

interface Shop {
  id: string
  name: string
  parentId: string | null
}

export default function NewShopPage() {
  const router = useRouter()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string>('none')
  const [address, setAddress] = useState('')

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          parentId: parentId === 'none' ? null : parentId,
          address: address || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create shop')
      }

      router.push('/shops')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  // Build hierarchical display for parent dropdown
  const getShopDisplayName = (shop: Shop, allShops: Shop[]): string => {
    const parts: string[] = [shop.name]
    let current = shop
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
        <h1 className="text-2xl font-bold">Add New Shop</h1>
        <p className="text-muted-foreground">
          Create a new shop location for your company
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Shop Details</CardTitle>
          <CardDescription>
            Enter the information for your new shop. A unique QR code will be
            generated automatically.
          </CardDescription>
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
                placeholder="e.g., Tokyo Shibuya Store"
                required
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentId">Parent Shop (Optional)</Label>
              <Select
                value={parentId}
                onValueChange={setParentId}
                disabled={loading || submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (top level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top level)</SelectItem>
                  {shops.map((shop) => (
                    <SelectItem key={shop.id} value={shop.id}>
                      {getShopDisplayName(shop, shops)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Use this to create regions or group shops under a parent location
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address (Optional)</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., 1-2-3 Shibuya, Tokyo"
                disabled={submitting}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={submitting || !name}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Shop'
                )}
              </Button>
              <Link href="/shops">
                <Button type="button" variant="outline" disabled={submitting}>
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
