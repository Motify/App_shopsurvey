'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  Loader2,
  ArrowLeft,
  Store,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Shield,
  Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Shop {
  id: string
  name: string
  parentId: string | null
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
            ({node.children.length} 子事業所)
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

export default function InviteAdminPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isFullAccess, setIsFullAccess] = useState(false)
  const [selectedShopIds, setSelectedShopIds] = useState<Set<string>>(new Set())
  const [shops, setShops] = useState<Shop[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchShops()
  }, [])

  const fetchShops = async () => {
    try {
      const res = await fetch('/api/shops')
      if (res.ok) {
        const data = await res.json()
        setShops(data)
        const parents = data.filter((s: Shop) =>
          data.some((c: Shop) => c.parentId === s.id)
        )
        setExpandedIds(new Set(parents.map((p: Shop) => p.id)))
      }
    } catch (err) {
      console.error(err)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !email.trim()) {
      setError('名前とメールアドレスを入力してください')
      return
    }

    if (!isFullAccess && selectedShopIds.size === 0) {
      setError('事業所を選択するか、フルアクセスを有効にしてください')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/admins/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          isFullAccess,
          shopIds: isFullAccess ? [] : Array.from(selectedShopIds),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to invite')
      }

      router.push('/admins')
    } catch (err) {
      setError(err instanceof Error ? err.message : '招待に失敗しました')
    } finally {
      setSubmitting(false)
    }
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
        <h1 className="text-2xl font-bold">管理者を招待</h1>
        <p className="text-muted-foreground">
          新しい管理者を招待してアクセス権限を設定します
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
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
                  placeholder="山田 太郎"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
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
                    全事業所へのアクセスと管理者の管理が可能になります
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  招待メールが送信されます
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>事業所アクセス権限</CardTitle>
              <CardDescription>
                {isFullAccess
                  ? 'フルアクセスが有効なため、全事業所にアクセスできます'
                  : 'アクセスを許可する事業所を選択してください（親事業所を選択すると子事業所も含まれます）'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : isFullAccess ? (
                <div className="p-8 text-center bg-slate-50 rounded-lg">
                  <Shield className="h-12 w-12 text-blue-500 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    全 {shops.length} 事業所にアクセス可能
                  </p>
                </div>
              ) : shops.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-lg">
                  <Store className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    事業所がありません
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
                  {selectedShopIds.size} 事業所を選択中
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <Link href="/admins">
            <Button type="button" variant="outline">
              キャンセル
            </Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            招待を送信
          </Button>
        </div>
      </form>
    </div>
  )
}
