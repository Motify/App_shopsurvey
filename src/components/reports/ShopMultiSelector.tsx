'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ChevronRight, Store, Search } from 'lucide-react'

interface Shop {
  id: string
  name: string
  parentId: string | null
  children?: Shop[]
}

interface ShopMultiSelectorProps {
  shops: Shop[]
  selected: string[]
  onChange: (shopIds: string[]) => void
  min?: number
  max?: number
}

function ShopCheckboxRow({
  shop,
  checked,
  disabled,
  onToggle,
  depth = 0,
}: {
  shop: Shop
  checked: boolean
  disabled: boolean
  onToggle: () => void
  depth?: number
}) {
  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 hover:bg-slate-50 border-b last:border-b-0',
          checked && 'bg-blue-50',
          disabled && !checked && 'opacity-50'
        )}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={onToggle}
          id={`shop-${shop.id}`}
        />
        {depth > 0 && <ChevronRight className="h-3 w-3 text-slate-400" />}
        <Store className="h-4 w-4 text-slate-500" />
        <label
          htmlFor={`shop-${shop.id}`}
          className={cn(
            'flex-1 text-sm cursor-pointer',
            checked && 'font-medium text-blue-700'
          )}
        >
          {shop.name}
        </label>
      </div>
      {shop.children?.map((child) => (
        <ShopCheckboxRow
          key={child.id}
          shop={child}
          checked={false}
          disabled={disabled}
          onToggle={() => {}}
          depth={depth + 1}
        />
      ))}
    </>
  )
}

// Flatten shops with depth for display
function flattenShops(shops: Shop[], depth = 0): Array<Shop & { depth: number }> {
  const result: Array<Shop & { depth: number }> = []
  for (const shop of shops) {
    result.push({ ...shop, depth })
    if (shop.children && shop.children.length > 0) {
      result.push(...flattenShops(shop.children, depth + 1))
    }
  }
  return result
}

export function ShopMultiSelector({
  shops,
  selected,
  onChange,
  min = 2,
  max = 5,
}: ShopMultiSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const flatShops = flattenShops(shops)

  // Filter shops by search query
  const filteredShops = searchQuery.trim()
    ? flatShops.filter((shop) =>
        shop.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : flatShops

  const handleToggle = (shopId: string) => {
    if (selected.includes(shopId)) {
      onChange(selected.filter((id) => id !== shopId))
    } else if (selected.length < max) {
      onChange([...selected, shopId])
    }
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-2">
        {selected.length} / {max} 店舗を選択中 (最低{min}店舗)
      </p>

      {/* Search input */}
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="店舗名で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border rounded-lg max-h-72 overflow-y-auto">
        {filteredShops.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchQuery ? '検索結果がありません' : '店舗がありません'}
          </div>
        ) : (
          filteredShops.map((shop) => (
            <div
              key={shop.id}
              className={cn(
                'flex items-center gap-2 px-3 py-2 hover:bg-slate-50 border-b last:border-b-0',
                selected.includes(shop.id) && 'bg-blue-50',
                !selected.includes(shop.id) && selected.length >= max && 'opacity-50'
              )}
              style={{ paddingLeft: `${12 + shop.depth * 20}px` }}
            >
              <Checkbox
                checked={selected.includes(shop.id)}
                disabled={!selected.includes(shop.id) && selected.length >= max}
                onCheckedChange={() => handleToggle(shop.id)}
                id={`shop-select-${shop.id}`}
              />
              {shop.depth > 0 && <ChevronRight className="h-3 w-3 text-slate-400" />}
              <Store className="h-4 w-4 text-slate-500" />
              <label
                htmlFor={`shop-select-${shop.id}`}
                className={cn(
                  'flex-1 text-sm cursor-pointer',
                  selected.includes(shop.id) && 'font-medium text-blue-700'
                )}
              >
                {shop.name}
              </label>
            </div>
          ))
        )}
      </div>
      {selected.length < min && (
        <p className="text-xs text-amber-600 mt-2">
          比較するには最低{min}店舗を選択してください
        </p>
      )}
    </div>
  )
}
