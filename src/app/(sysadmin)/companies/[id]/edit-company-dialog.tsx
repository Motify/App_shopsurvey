'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil, Loader2 } from 'lucide-react'

interface Industry {
  id: string
  code: string
  nameJa: string
  nameEn: string
}

interface EditCompanyDialogProps {
  companyId: string
  currentIndustryId: string
  currentIndustryName: string
}

export function EditCompanyDialog({
  companyId,
  currentIndustryId,
  currentIndustryName,
}: EditCompanyDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [industries, setIndustries] = useState<Industry[]>([])
  const [loadingIndustries, setLoadingIndustries] = useState(true)
  const [selectedIndustryId, setSelectedIndustryId] = useState(currentIndustryId)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      fetchIndustries()
      setSelectedIndustryId(currentIndustryId)
    }
  }, [open, currentIndustryId])

  const fetchIndustries = async () => {
    setLoadingIndustries(true)
    try {
      const response = await fetch('/api/industries')
      if (response.ok) {
        const data = await response.json()
        setIndustries(data)
      }
    } catch (err) {
      console.error('Failed to fetch industries:', err)
    } finally {
      setLoadingIndustries(false)
    }
  }

  const handleSave = async () => {
    if (selectedIndustryId === currentIndustryId) {
      setOpen(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industryId: selectedIndustryId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update company')
      }

      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Company Settings</DialogTitle>
          <DialogDescription>
            Change the industry type for this company
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Industry</Label>
            <Select
              value={selectedIndustryId}
              onValueChange={setSelectedIndustryId}
              disabled={loadingIndustries || loading}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingIndustries ? 'Loading...' : 'Select industry'} />
              </SelectTrigger>
              <SelectContent>
                {industries.map((industry) => (
                  <SelectItem key={industry.id} value={industry.id}>
                    {industry.nameEn} ({industry.nameJa})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Current: {currentIndustryName}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading || loadingIndustries}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
