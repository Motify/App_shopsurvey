/**
 * In-memory rate limiter for API endpoints
 * For production with multiple instances, consider using Redis
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store (reset on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  rateLimitStore.forEach((entry, key) => {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  })
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number
  /** Time window in seconds */
  windowSeconds: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
}

/**
 * Check rate limit for a given identifier
 * @param identifier - Unique identifier (e.g., IP address, user ID, email)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const key = identifier
  const entry = rateLimitStore.get(key)

  // If no entry or expired, create new entry
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowSeconds * 1000,
    }
    rateLimitStore.set(key, newEntry)
    return {
      success: true,
      remaining: config.limit - 1,
      resetTime: newEntry.resetTime,
    }
  }

  // Check if limit exceeded
  if (entry.count >= config.limit) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  // Increment count
  entry.count++
  rateLimitStore.set(key, entry)

  return {
    success: true,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(request: Request): string {
  // Check common proxy headers
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // Fallback
  return 'unknown'
}

// Predefined rate limit configurations
export const RATE_LIMITS = {
  // Auth endpoints - stricter limits
  login: { limit: 5, windowSeconds: 15 * 60 } as RateLimitConfig, // 5 per 15 min
  passwordReset: { limit: 3, windowSeconds: 60 * 60 } as RateLimitConfig, // 3 per hour
  passwordSetup: { limit: 5, windowSeconds: 15 * 60 } as RateLimitConfig, // 5 per 15 min

  // Survey endpoints
  surveyResponse: { limit: 10, windowSeconds: 60 * 60 } as RateLimitConfig, // 10 per hour
  surveyEmailSend: { limit: 100, windowSeconds: 60 * 60 } as RateLimitConfig, // 100 per hour

  // API endpoints - more lenient
  api: { limit: 100, windowSeconds: 60 } as RateLimitConfig, // 100 per minute
}

/**
 * Create rate limit error response
 */
export function rateLimitResponse(resetTime: number) {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
  return new Response(
    JSON.stringify({
      error: 'リクエスト回数の上限に達しました。しばらくしてから再試行してください。',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    }
  )
}
