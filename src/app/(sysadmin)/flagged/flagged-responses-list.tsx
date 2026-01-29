'use client'

import { useState } from 'react'
import { formatDistanceToNow } from '@/lib/date-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, ChevronDown, ChevronUp, Lock, Eye, Building2, Store } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FlaggedResponse {
  id: string
  shopId: string
  comment: string | null
  positiveText: string | null
  improvementText: string | null
  flagReason: string | null
  encryptedIdentity: string | null
  identityConsent: boolean
  submittedAt: Date
  shop: {
    id: string
    name: string
    company: {
      id: string
      name: string
    }
  }
}

interface FlaggedResponsesListProps {
  responses: FlaggedResponse[]
}

function getFlagCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    harassment: 'Harassment',
    safety: 'Safety Concern',
    crisis: 'Mental Health',
    discrimination: 'Discrimination',
  }
  return labels[category] || category
}

function getFlagBadgeColor(category: string): string {
  const colors: Record<string, string> = {
    harassment: 'bg-red-100 text-red-700',
    safety: 'bg-orange-100 text-orange-700',
    crisis: 'bg-purple-100 text-purple-700',
    discrimination: 'bg-yellow-100 text-yellow-700',
  }
  return colors[category] || 'bg-slate-100 text-slate-700'
}

export function FlaggedResponsesList({ responses }: FlaggedResponsesListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const [revealedIdentity, setRevealedIdentity] = useState<Record<string, string>>({})
  const [revealForm, setRevealForm] = useState<{ reason: string; requestedBy: string }>({
    reason: '',
    requestedBy: '',
  })
  const [revealError, setRevealError] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
    setRevealingId(null)
    setRevealError(null)
  }

  const handleRevealIdentity = async (responseId: string) => {
    if (!revealForm.reason.trim() || !revealForm.requestedBy.trim()) {
      setRevealError('Please fill in both reason and requested by fields')
      return
    }

    try {
      const res = await fetch(`/api/sysadmin/responses/${responseId}/reveal-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(revealForm),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to reveal identity')
      }

      const data = await res.json()
      setRevealedIdentity((prev) => ({ ...prev, [responseId]: data.identity }))
      setRevealingId(null)
      setRevealForm({ reason: '', requestedBy: '' })
    } catch (err) {
      setRevealError(err instanceof Error ? err.message : 'Failed to reveal identity')
    }
  }

  if (responses.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <p className="text-slate-500">No flagged responses</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {responses.map((response) => {
        const isExpanded = expandedId === response.id
        const flagReasons = response.flagReason?.split(', ') || []
        const hasIdentity = !!response.encryptedIdentity
        const isRevealed = !!revealedIdentity[response.id]
        const isRevealFormOpen = revealingId === response.id

        return (
          <Card key={response.id} className="overflow-hidden">
            <CardHeader
              className="cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => toggleExpand(response.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <span className="font-medium">{response.shop.company.name}</span>
                      <span className="text-slate-400">/</span>
                      <Store className="h-4 w-4 text-slate-400" />
                      <span>{response.shop.name}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {formatDistanceToNow(new Date(response.submittedAt))} ago
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    {flagReasons.map((reason) => (
                      <span
                        key={reason}
                        className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          getFlagBadgeColor(reason)
                        )}
                      >
                        {getFlagCategoryLabel(reason)}
                      </span>
                    ))}
                  </div>
                  {hasIdentity && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                      <Lock className="h-3 w-3" />
                      Has Identity
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="border-t bg-slate-50">
                <div className="space-y-4 pt-4">
                  {/* Response content */}
                  {response.comment && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-1">Comment</h4>
                      <p className="bg-white p-3 rounded border text-sm">{response.comment}</p>
                    </div>
                  )}
                  {response.positiveText && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-1">Positive Feedback</h4>
                      <p className="bg-white p-3 rounded border text-sm">{response.positiveText}</p>
                    </div>
                  )}
                  {response.improvementText && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-1">Improvement Suggestions</h4>
                      <p className="bg-white p-3 rounded border text-sm">{response.improvementText}</p>
                    </div>
                  )}

                  {/* Identity reveal section */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-bold text-red-600 flex items-center gap-2 mb-3">
                      <Lock className="h-4 w-4" />
                      Identity Disclosure
                    </h4>

                    {!hasIdentity ? (
                      <p className="text-sm text-slate-500">
                        Respondent did not provide contact information
                      </p>
                    ) : isRevealed ? (
                      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                        <p className="font-mono text-sm">{revealedIdentity[response.id]}</p>
                        <p className="text-xs text-slate-500 mt-2">
                          Access to this information has been logged
                        </p>
                      </div>
                    ) : isRevealFormOpen ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Reason for disclosure *
                          </label>
                          <textarea
                            value={revealForm.reason}
                            onChange={(e) =>
                              setRevealForm((prev) => ({ ...prev, reason: e.target.value }))
                            }
                            className="w-full p-2 border rounded text-sm"
                            placeholder="Explain why this information is needed"
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Requested by *
                          </label>
                          <input
                            type="text"
                            value={revealForm.requestedBy}
                            onChange={(e) =>
                              setRevealForm((prev) => ({ ...prev, requestedBy: e.target.value }))
                            }
                            className="w-full p-2 border rounded text-sm"
                            placeholder="Company name / Contact person"
                          />
                        </div>
                        {revealError && (
                          <p className="text-sm text-red-600">{revealError}</p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRevealIdentity(response.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Reveal Identity
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRevealingId(null)
                              setRevealError(null)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => setRevealingId(response.id)}
                      >
                        <Lock className="h-4 w-4 mr-1" />
                        Request Identity Disclosure
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
