'use client'

import React, {
  useState,
  useMemo,
  useCallback,
  createContext,
  useContext,
} from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  ChevronRight,
  ChevronDown,
  GripVertical,
  FolderOpen,
  Store,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
export interface TreeItem {
  id: string
  name: string
  parentId: string | null
  shopNumber?: string | null
}

export type TreeNode<T extends TreeItem> = T & {
  children: TreeNode<T>[]
  level: number
}

export type SortOption<T extends TreeItem = TreeItem> = {
  label: string
  value: string
  compareFn: (a: T, b: T) => number
}

// Default sort options
export const defaultSortOptions: SortOption[] = [
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
]

// Context for tree state
interface TreeContextValue {
  expandedIds: Set<string>
  selectedIds: Set<string>
  toggleExpand: (id: string) => void
  toggleSelect: (id: string) => void
  searchQuery: string
  isDragging: boolean
}

const TreeContext = createContext<TreeContextValue | null>(null)

function useTreeContext() {
  const context = useContext(TreeContext)
  if (!context) {
    throw new Error('useTreeContext must be used within TreeProvider')
  }
  return context
}

// Build tree from flat array
export function buildTree<T extends TreeItem>(items: T[]): TreeNode<T>[] {
  const itemMap = new Map<string, TreeNode<T>>()
  const roots: TreeNode<T>[] = []

  items.forEach((item) => {
    itemMap.set(item.id, { ...item, children: [], level: 0 } as TreeNode<T>)
  })

  items.forEach((item) => {
    const node = itemMap.get(item.id)!
    if (item.parentId && itemMap.has(item.parentId)) {
      const parent = itemMap.get(item.parentId)!
      node.level = parent.level + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}

// Flatten tree for rendering
function flattenTree<T extends TreeItem>(
  nodes: TreeNode<T>[],
  expandedIds: Set<string>,
  searchQuery: string
): TreeNode<T>[] {
  const result: TreeNode<T>[] = []
  const lowerQuery = searchQuery.toLowerCase()

  function matchesSearch(node: TreeNode<T>): boolean {
    if (!searchQuery) return true
    const nameMatch = node.name.toLowerCase().includes(lowerQuery)
    const numberMatch = node.shopNumber?.toLowerCase().includes(lowerQuery)
    return nameMatch || numberMatch || false
  }

  function hasMatchingDescendant(node: TreeNode<T>): boolean {
    if (matchesSearch(node)) return true
    return node.children.some((child) => hasMatchingDescendant(child))
  }

  function traverse(nodes: TreeNode<T>[]) {
    for (const node of nodes) {
      const matches = matchesSearch(node)
      const hasMatch = hasMatchingDescendant(node)

      if (hasMatch) {
        result.push(node)
        if (
          node.children.length > 0 &&
          (expandedIds.has(node.id) || (searchQuery && hasMatch))
        ) {
          traverse(node.children)
        }
      }
    }
  }

  traverse(nodes)
  return result
}

// Sort tree nodes
function sortTree<T extends TreeItem>(
  nodes: TreeNode<T>[],
  compareFn: (a: T, b: T) => number
): TreeNode<T>[] {
  const sorted = [...nodes].sort(compareFn)
  sorted.forEach((node) => {
    if (node.children.length > 0) {
      node.children = sortTree(node.children, compareFn)
    }
  })
  return sorted
}

// Sortable Tree Item Component
interface SortableTreeItemProps<T extends TreeItem> {
  node: TreeNode<T>
  renderItem: (node: TreeNode<T>, dragHandleProps: object) => React.ReactNode
  disabled?: boolean
}

function SortableTreeItem<T extends TreeItem>({
  node,
  renderItem,
  disabled,
}: SortableTreeItemProps<T>) {
  const { isDragging: contextDragging } = useTreeContext()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const dragHandleProps = {
    ...attributes,
    ...listeners,
    className: cn(
      'cursor-grab active:cursor-grabbing p-1 hover:bg-slate-200 rounded',
      contextDragging && !isDragging && 'pointer-events-none'
    ),
  }

  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(node, dragHandleProps)}
    </div>
  )
}

// Default Tree Item Renderer
interface DefaultTreeItemProps<T extends TreeItem> {
  node: TreeNode<T>
  dragHandleProps: object
  onShowQR?: (item: T) => void
  renderActions?: (item: T) => React.ReactNode
}

export function DefaultTreeItem<T extends TreeItem>({
  node,
  dragHandleProps,
  onShowQR,
  renderActions,
}: DefaultTreeItemProps<T>) {
  const { expandedIds, selectedIds, toggleExpand, toggleSelect, searchQuery } =
    useTreeContext()

  const hasChildren = node.children.length > 0
  const isExpanded = expandedIds.has(node.id) || !!searchQuery
  const isSelected = selectedIds.has(node.id)

  return (
    <div
      className={cn(
        'flex items-center gap-2 py-2 px-3 rounded-md hover:bg-slate-100 transition-colors',
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

      <div className="flex-1 flex items-center gap-3 min-w-0">
        {node.shopNumber && (
          <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
            {node.shopNumber}
          </span>
        )}
        <span className="font-medium text-slate-900 truncate">{node.name}</span>
      </div>

      {renderActions && renderActions(node)}
    </div>
  )
}

// Main SortableTree Component
export interface SortableTreeProps<T extends TreeItem> {
  items: T[]
  sortOptions?: SortOption<T>[]
  defaultSortValue?: string
  enableSearch?: boolean
  enableSort?: boolean
  enableDragDrop?: boolean
  enableSelection?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  onReorder?: (itemId: string, newParentId: string | null, newIndex: number) => void
  renderItem?: (node: TreeNode<T>, dragHandleProps: object) => React.ReactNode
  renderActions?: (item: T) => React.ReactNode
  emptyMessage?: string
  className?: string
  // Controlled search/sort props
  searchQuery?: string
  onSearchChange?: (query: string) => void
  sortValue?: string
  onSortChange?: (value: string) => void
  hideControls?: boolean
}

export function SortableTree<T extends TreeItem>({
  items,
  sortOptions = defaultSortOptions as SortOption<T>[],
  defaultSortValue = 'name',
  enableSearch = true,
  enableSort = true,
  enableDragDrop = true,
  enableSelection = true,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
  onReorder,
  renderItem,
  renderActions,
  emptyMessage = 'アイテムがありません',
  className,
  // Controlled props
  searchQuery: controlledSearchQuery,
  onSearchChange,
  sortValue: controlledSortValue,
  onSortChange,
  hideControls = false,
}: SortableTreeProps<T>) {
  const [internalSearchQuery, setInternalSearchQuery] = useState('')
  const [internalSortValue, setInternalSortValue] = useState(defaultSortValue)

  // Use controlled or internal state
  const searchQuery = controlledSearchQuery ?? internalSearchQuery
  const setSearchQuery = onSearchChange ?? setInternalSearchQuery
  const sortValue = controlledSortValue ?? internalSortValue
  const setSortValue = onSortChange ?? setInternalSortValue
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Default expand parents with children
    const parents = new Set<string>()
    items.forEach((item) => {
      if (items.some((other) => other.parentId === item.id)) {
        parents.add(item.id)
      }
    })
    return parents
  })
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(
    new Set()
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const selectedIds = controlledSelectedIds ?? internalSelectedIds
  const setSelectedIds = useCallback(
    (value: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      if (onSelectionChange) {
        if (typeof value === 'function') {
          onSelectionChange(value(selectedIds))
        } else {
          onSelectionChange(value)
        }
      } else {
        setInternalSelectedIds(value)
      }
    },
    [onSelectionChange, selectedIds]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Build and sort tree
  const tree = useMemo(() => {
    const built = buildTree(items)
    const sortOption = sortOptions.find((o) => o.value === sortValue)
    if (sortOption) {
      return sortTree(built, sortOption.compareFn)
    }
    return built
  }, [items, sortValue, sortOptions])

  // Flatten for rendering
  const flattenedItems = useMemo(
    () => flattenTree(tree, expandedIds, searchQuery),
    [tree, expandedIds, searchQuery]
  )

  const toggleExpand = useCallback((id: string) => {
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

  const toggleSelect = useCallback(
    (id: string) => {
      if (!enableSelection) return
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    },
    [enableSelection, setSelectedIds]
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string | null)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)
      setOverId(null)

      if (!over || active.id === over.id || !onReorder) return

      const activeItem = items.find((i) => i.id === active.id)
      const overItem = items.find((i) => i.id === over.id)

      if (!activeItem || !overItem) return

      // Find the new position
      const overIndex = flattenedItems.findIndex((i) => i.id === over.id)

      // Determine new parent - if dropping on an item, make it a child of that item
      // For simplicity, we'll just reorder at the same level for now
      const newParentId = overItem.parentId

      onReorder(active.id as string, newParentId, overIndex)
    },
    [items, flattenedItems, onReorder]
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setOverId(null)
  }, [])

  const activeNode = activeId
    ? flattenedItems.find((n) => n.id === activeId)
    : null

  const contextValue: TreeContextValue = {
    expandedIds,
    selectedIds,
    toggleExpand,
    toggleSelect,
    searchQuery,
    isDragging: !!activeId,
  }

  const defaultRenderItem = useCallback(
    (node: TreeNode<T>, dragHandleProps: object) => (
      <DefaultTreeItem
        node={node}
        dragHandleProps={dragHandleProps}
        renderActions={renderActions}
      />
    ),
    [renderActions]
  )

  const itemRenderer = renderItem || defaultRenderItem

  return (
    <TreeContext.Provider value={contextValue}>
      <div className={cn('space-y-4', className)}>
        {/* Search and Sort Controls */}
        {!hideControls && (enableSearch || enableSort) && (
          <div className="flex items-center gap-4">
            {enableSearch && (
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
            {enableSort && sortOptions.length > 0 && (
              <Select value={sortValue} onValueChange={setSortValue}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Tree Content */}
        {flattenedItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? '検索結果がありません' : emptyMessage}
          </div>
        ) : enableDragDrop ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={flattenedItems.map((n) => n.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {flattenedItems.map((node) => (
                  <SortableTreeItem
                    key={node.id}
                    node={node}
                    renderItem={itemRenderer}
                    disabled={!!searchQuery}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeNode && (
                <div className="bg-white shadow-lg rounded-md border">
                  {itemRenderer(activeNode, {})}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="space-y-1">
            {flattenedItems.map((node) => (
              <div key={node.id}>{itemRenderer(node, {})}</div>
            ))}
          </div>
        )}
      </div>
    </TreeContext.Provider>
  )
}

export { useTreeContext }
