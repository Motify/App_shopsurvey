'use client'

import { useState, useEffect, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle, Check, X } from 'lucide-react'

// Password validation rules
const passwordRules = [
  { key: 'length', label: '8文字以上', test: (p: string) => p.length >= 8 },
  { key: 'uppercase', label: '大文字を含む (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lowercase', label: '小文字を含む (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { key: 'number', label: '数字を含む (0-9)', test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: '特殊文字を含む (!@#$%^&*等)', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
]

interface TokenValidation {
  valid: boolean
  email?: string
  error?: string
}

function SetupPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const isReset = searchParams.get('reset') === 'true'

  const [isValidating, setIsValidating] = useState(true)
  const [tokenValidation, setTokenValidation] = useState<TokenValidation | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Check which password rules are satisfied
  const ruleResults = useMemo(() => {
    return passwordRules.map(rule => ({
      ...rule,
      passed: rule.test(password),
    }))
  }, [password])

  const allRulesPassed = ruleResults.every(r => r.passed)

  useEffect(() => {
    if (!token) {
      setTokenValidation({ valid: false, error: 'No token provided' })
      setIsValidating(false)
      return
    }

    // Validate token
    fetch(`/api/auth/validate-token?token=${token}`)
      .then(res => res.json())
      .then(data => {
        setTokenValidation(data)
        setIsValidating(false)
      })
      .catch(() => {
        setTokenValidation({ valid: false, error: 'Failed to validate token' })
        setIsValidating(false)
      })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!allRulesPassed) {
      setError('パスワードが要件を満たしていません')
      return
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/auth/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to set password')
      }

      // Redirect to login with success message
      router.push('/login?success=Password set successfully. Please log in.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state
  if (isValidating) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Validating your invite...</p>
        </CardContent>
      </Card>
    )
  }

  // Invalid or expired token
  if (!tokenValidation?.valid) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <CardTitle>Invalid or Expired Link</CardTitle>
          <CardDescription>
            {tokenValidation?.error || 'This invite link is no longer valid.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Please contact your administrator to request a new invite.
          </p>
          <Link href="/login">
            <Button variant="outline">Go to Login</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  // Valid token - show password form
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-foreground">S</span>
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">
          {isReset ? 'Reset Your Password' : 'Set Up Your Account'}
        </CardTitle>
        <CardDescription>
          {isReset
            ? 'Enter your new password below'
            : 'Create a password to complete your account setup'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={tokenValidation.email}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">新しいパスワード</Label>
            <Input
              id="password"
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />

            {/* Password Rules Checklist */}
            <div className="mt-3 p-3 bg-muted/50 rounded-md">
              <p className="text-xs font-medium text-muted-foreground mb-2">パスワード要件:</p>
              <ul className="space-y-1">
                {ruleResults.map((rule) => (
                  <li key={rule.key} className="flex items-center gap-2 text-xs">
                    {rule.passed ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className={rule.passed ? 'text-green-700' : 'text-muted-foreground'}>
                      {rule.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">パスワード確認</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="パスワードを再入力"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-destructive mt-1">パスワードが一致しません</p>
            )}
            {confirmPassword && password === confirmPassword && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <Check className="h-3 w-3" /> パスワードが一致しています
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !allRulesPassed || password !== confirmPassword}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                設定中...
              </>
            ) : (
              'パスワードを設定'
            )}
          </Button>
        </CardContent>
      </form>
    </Card>
  )
}

function LoadingFallback() {
  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </CardContent>
    </Card>
  )
}

export default function SetupPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Suspense fallback={<LoadingFallback />}>
        <SetupPasswordForm />
      </Suspense>
    </div>
  )
}
