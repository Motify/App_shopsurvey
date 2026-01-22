'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  ArrowLeft,
  Store,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Shield,
  KeyRound,
  Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Shop {
  id: string
  name: string
  parentId: string | null
  _count?: { children: number }
}

interface TreeNode extends Shop {
  children: TreeNode[]
  level: number
}

interface Admin {
  id: string
  name: string
  email: string
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE'
  isFullAccess: boolean
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

function getDescendantIds(node: TreeNode): string[] {
  return [
    ...node.children.map((c) => c.id),
    ...node.children.flatMap((c) => getDescendantIds(c)),
  ]
}

function ShopTreeItem({
  node,
  selectedIds,
  expandedIds,
  onToggleSelect,
  onToggleExpand,
}: {
  node: TreeNode
  selectedIds: Set<string>
  expandedIds: Set<string>
  onToggleSelect: (id: string, checked: boolean, descendants: string[]) => void
  onToggleExpand: (id: string) => void
}) {
  const hasChildren = node.children.length > 0
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedIds.has(node.id)
  const descendants = getDescendantIds(node)

  const selectedDescendantCount = descendants.filter((id) =>
    selectedIds.has(id)
  ).length
  const isIndeterminate =
    !isSelected &&
    selectedDescendantCount > 0 &&
    selectedDescendantCount < descendants.length

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-slate-100"
        style={{ paddingLeft: `${node.level * 24 + 12}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => onToggleExpand(node.id)}
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

        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) =>
            onToggleSelect(node.id, checked as boolean, descendants)
          }
          className={cn(isIndeterminate && 'opacity-50')}
        />

        {hasChildren ? (
          <FolderOpen className="h-4 w-4 text-amber-500" />
        ) : (
          <Store className="h-4 w-4 text-slate-500" />
        )}

        <span className="text-sm font-medium">{node.name}</span>
        {hasChildren && (
          <span className="text-xs text-muted-foreground">
            ({node.children.length} 子店舗)
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <ShopTreeItem
              key={child.id}
              node={child}
              selectedIds={selectedIds}
              expandedIds={expandedIds}
              onToggleSelect={onToggleSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminEditPage() {
  const router = useRouter()
  const params = useParams()
  const adminId = params.id as string

  const [admin, setAdmin] = useState<Admin | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [selectedShopIds, setSelectedShopIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [isFullAccess, setIsFullAccess] = useState(false)
  const [status, setStatus] = useState<string>('ACTIVE')
  const [sendingReset, setSendingReset] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  useEffect(() => {
    fetchData()
  }, [adminId])

  const fetchData = async () => {
    try {
      const [adminRes, shopsRes, assignmentsRes] = await Promise.all([
        fetch(`/api/admins/${adminId}`),
        fetch('/api/shops'),
        fetch(`/api/admins/${adminId}/assignments`),
      ])

      if (!adminRes.ok) {
        if (adminRes.status === 403) {
          setError('このページにアクセスする権限がありません')
        } else {
          setError('管理者が見つかりません')
        }
        return
      }

      const adminData = await adminRes.json()
      const shopsData = await shopsRes.json()
      const assignmentsData = await assignmentsRes.json()

      setAdmin(adminData)
      setShops(shopsData)
      setName(adminData.name)
      setIsFullAccess(adminData.isFullAccess)
      setStatus(adminData.status)
      setSelectedShopIds(new Set(assignmentsData.shopIds))

      const parents = shopsData.filter((s: Shop) =>
        shopsData.some((c: Shop) => c.parentId === s.id)
      )
      setExpandedIds(new Set(parents.map((p: Shop) => p.id)))
    } catch (err) {
      setError('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSelect = useCallback(
    (shopId: string, checked: boolean, descendants: string[]) => {
      setSelectedShopIds((prev) => {
        const next = new Set(prev)
        if (checked) {
          next.add(shopId)
          descendants.forEach((id) => next.add(id))
        } else {
          next.delete(shopId)
          descendants.forEach((id) => next.delete(id))
        }
        return next
      })
    },
    []
  )

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleResetPassword = async () => {
    if (!confirm('この管理者にパスワードリセットメールを送信しますか？')) {
      return
    }

    setSendingReset(true)
    setError('')
    setResetSuccess(false)

    try {
      const response = await fetch(`/api/admins/${adminId}/reset-password`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send reset email')
      }

      setResetSuccess(true)
      setTimeout(() => setResetSuccess(false), 5000) // Hide success after 5 seconds
    } catch (err) {
      setError(err instanceof Error ? err.message : 'パスワードリセットメールの送信に失敗しました')
    } finally {
      setSendingReset(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      const adminRes = await fetch(`/api/admins/${adminId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, isFullAccess, status }),
      })

      if (!adminRes.ok) {
        const data = await adminRes.json()
        throw new Error(data.error || 'Failed to update admin')
      }

      if (!isFullAccess) {
        const assignRes = await fetch(`/api/admins/${adminId}/assignments`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shopIds: Array.from(selectedShopIds) }),
        })

        if (!assignRes.ok) {
          throw new Error('Failed to update assignments')
        }
      }

      router.push('/admins')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !admin) {
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

  const tree = buildTree(shops)

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/admins"
          className="flex items-center text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          管理者一覧に戻る
        </Link>
        <h1 className="text-2xl font-bold">管理者編集</h1>
        <p className="text-muted-foreground">{admin?.email}</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">名前</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">ステータス</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">有効</SelectItem>
                  <SelectItem value="INACTIVE">無効</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Checkbox
                id="fullAccess"
                checked={isFullAccess}
                onCheckedChange={(checked) =>
                  setIsFullAccess(checked as boolean)
                }
              />
              <div className="flex-1">
                <Label htmlFor="fullAccess" className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    フルアクセス
                  </div>
                </Label>
                <p className="text-xs text-muted-foreground">
                  全店舗へのアクセスと管理者の管理が可能になります
                </p>
              </div>
            </div>

            {/* Password Reset Section */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    パスワードリセット
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    パスワードリセットメールを送信します
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetPassword}
                  disabled={sendingReset}
                >
                  {sendingReset ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      送信中...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      リセットメール送信
                    </>
                  )}
                </Button>
              </div>
              {resetSuccess && (
                <div className="mt-3 p-3 bg-green-50 text-green-700 rounded-md text-sm">
                  パスワードリセットメールを送信しました。
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>店舗アクセス権限</CardTitle>
            <CardDescription>
              {isFullAccess
                ? 'フルアクセスが有効なため、全店舗にアクセスできます'
                : 'アクセスを許可する店舗を選択してください（親店舗を選択すると子店舗も含まれます）'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isFullAccess ? (
              <div className="p-8 text-center bg-slate-50 rounded-lg">
                <Shield className="h-12 w-12 text-blue-500 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  全 {shops.length} 店舗にアクセス可能
                </p>
              </div>
            ) : shops.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-lg">
                <Store className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  店舗がありません
                </p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto border rounded-lg">
                {tree.map((node) => (
                  <ShopTreeItem
                    key={node.id}
                    node={node}
                    selectedIds={selectedShopIds}
                    expandedIds={expandedIds}
                    onToggleSelect={handleToggleSelect}
                    onToggleExpand={handleToggleExpand}
                  />
                ))}
              </div>
            )}
            {!isFullAccess && shops.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {selectedShopIds.size} 店舗を選択中
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-4 mt-6">
        <Link href="/admins">
          <Button variant="outline">キャンセル</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          保存
        </Button>
      </div>
    </div>
  )
}
