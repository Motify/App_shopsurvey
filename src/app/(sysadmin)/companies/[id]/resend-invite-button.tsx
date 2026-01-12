'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mail, Loader2, Check } from 'lucide-react'

interface ResendInviteButtonProps {
  adminId: string
  adminEmail: string
}

export function ResendInviteButton({ adminId, adminEmail }: ResendInviteButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleResend = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admins/${adminId}/resend-invite`, {
        method: 'POST',
      })

      if (response.ok) {
        setSent(true)
        setTimeout(() => setSent(false), 3000)
      }
    } catch (error) {
      console.error('Failed to resend invite:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (sent) {
    return (
      <Button size="sm" variant="ghost" disabled>
        <Check className="mr-2 h-4 w-4 text-green-600" />
        Sent!
      </Button>
    )
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleResend}
      disabled={isLoading}
      title={`Resend invite to ${adminEmail}`}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Mail className="mr-2 h-4 w-4" />
      )}
      Resend Invite
    </Button>
  )
}
