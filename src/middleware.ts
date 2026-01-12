import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth
  const userRole = req.auth?.user?.role

  // Public routes - no auth required
  const publicPaths = ['/', '/login', '/setup-password', '/forgot-password']
  const isPublicPath = publicPaths.includes(pathname)

  // Survey routes are always public (accessed via QR code)
  const isSurveyRoute = pathname.startsWith('/survey')

  // API routes handle their own auth
  const isApiRoute = pathname.startsWith('/api')

  // Static assets
  const isStaticAsset = pathname.startsWith('/_next') ||
                        pathname.startsWith('/favicon') ||
                        pathname.includes('.')

  // Allow public routes, survey routes, API routes, and static assets
  if (isPublicPath || isSurveyRoute || isApiRoute || isStaticAsset) {
    return NextResponse.next()
  }

  // All other routes require authentication
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', req.nextUrl)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // SysAdmin routes - /sysadmin/* or /companies/*
  const sysadminRoutes = ['/sysadmin', '/companies']
  const isSysadminRoute = sysadminRoutes.some(route => pathname.startsWith(route))

  if (isSysadminRoute && userRole !== 'sysadmin') {
    // Redirect non-sysadmins to their appropriate dashboard
    if (userRole === 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
    }
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  // Admin routes - /admin/*, /dashboard, /shops, /admins, /reports
  const adminRoutes = ['/dashboard', '/shops', '/admins', '/reports']
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))

  if (isAdminRoute) {
    // Both sysadmin and admin can access admin routes
    if (userRole !== 'sysadmin' && userRole !== 'admin') {
      return NextResponse.redirect(new URL('/login', req.nextUrl))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
