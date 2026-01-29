'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Trash2, Pencil, Factory, Building2, AlertTriangle } from 'lucide-react'

interface Industry {
  id: string
  code: string
  nameJa: string
  nameEn: string
  isDefault: boolean
  _count: {
    companies: number
    benchmarks: number
  }
}

export default function IndustriesPage() {
  const [industries, setIndustries] = useState<Industry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newNameJa, setNewNameJa] = useState('')
  const [newNameEn, setNewNameEn] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [industryToDelete, setIndustryToDelete] = useState<Industry | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [industryToEdit, setIndustryToEdit] = useState<Industry | null>(null)
  const [editNameJa, setEditNameJa] = useState('')
  const [editNameEn, setEditNameEn] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const fetchIndustries = async () => {
    try {
      const response = await fetch('/api/industries')
      if (!response.ok) throw new Error('Failed to fetch industries')
      const data = await response.json()
      setIndustries(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIndustries()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddLoading(true)
    setAddError(null)

    try {
      const response = await fetch('/api/industries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode.toUpperCase().replace(/\s+/g, '_'),
          nameJa: newNameJa,
          nameEn: newNameEn,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create industry')
      }

      setAddDialogOpen(false)
      setNewCode('')
      setNewNameJa('')
      setNewNameEn('')
      fetchIndustries()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setAddLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!industryToDelete) return
    setDeleteLoading(true)
    setDeleteError(null)

    try {
      const response = await fetch(`/api/industries/${industryToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete industry')
      }

      setDeleteDialogOpen(false)
      setIndustryToDelete(null)
      fetchIndustries()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!industryToEdit) return
    setEditLoading(true)
    setEditError(null)

    try {
      const response = await fetch(`/api/industries/${industryToEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameJa: editNameJa,
          nameEn: editNameEn,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update industry')
      }

      setEditDialogOpen(false)
      setIndustryToEdit(null)
      fetchIndustries()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setEditLoading(false)
    }
  }

  const openEditDialog = (industry: Industry) => {
    setIndustryToEdit(industry)
    setEditNameJa(industry.nameJa)
    setEditNameEn(industry.nameEn)
    setEditError(null)
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (industry: Industry) => {
    setIndustryToDelete(industry)
    setDeleteError(null)
    setDeleteDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Industries</h1>
          <p className="text-muted-foreground">Manage industry types for companies</p>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Industry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Industry</DialogTitle>
              <DialogDescription>
                Create a new industry type for companies to use.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    placeholder="e.g., HEALTHCARE"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z_]/g, ''))}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Uppercase letters and underscores only
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nameJa">Name (Japanese)</Label>
                  <Input
                    id="nameJa"
                    placeholder="e.g., 医療・ヘルスケア"
                    value={newNameJa}
                    onChange={(e) => setNewNameJa(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nameEn">Name (English)</Label>
                  <Input
                    id="nameEn"
                    placeholder="e.g., Healthcare"
                    value={newNameEn}
                    onChange={(e) => setNewNameEn(e.target.value)}
                    required
                  />
                </div>
                {addError && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {addError}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addLoading}>
                  {addLoading ? 'Creating...' : 'Create Industry'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Industry Types
          </CardTitle>
          <CardDescription>
            {industries.length} industries configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name (Japanese)</TableHead>
                <TableHead>Name (English)</TableHead>
                <TableHead className="text-center">Companies</TableHead>
                <TableHead className="text-center">Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {industries.map((industry) => (
                <TableRow key={industry.id}>
                  <TableCell className="font-mono text-sm">{industry.code}</TableCell>
                  <TableCell>{industry.nameJa}</TableCell>
                  <TableCell>{industry.nameEn}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      {industry._count.companies}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {industry.isDefault ? (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        Default
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        Custom
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(industry)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(industry)}
                        disabled={industry.isDefault || industry._count.companies > 0}
                        className={industry.isDefault || industry._count.companies > 0 ? 'opacity-50' : 'text-red-600 hover:text-red-700 hover:bg-red-50'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {industries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No industries found. Add your first industry.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Industry</DialogTitle>
            <DialogDescription>
              Update the industry names. Code cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={industryToEdit?.code || ''} disabled className="bg-gray-50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editNameJa">Name (Japanese)</Label>
                <Input
                  id="editNameJa"
                  value={editNameJa}
                  onChange={(e) => setEditNameJa(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editNameEn">Name (English)</Label>
                <Input
                  id="editNameEn"
                  value={editNameEn}
                  onChange={(e) => setEditNameEn(e.target.value)}
                  required
                />
              </div>
              {editError && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {editError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editLoading}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Industry
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{industryToDelete?.nameJa}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {deleteError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {deleteError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
