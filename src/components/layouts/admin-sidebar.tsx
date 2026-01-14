'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LayoutDashboard, Store, Users, Send, BarChart3, Building2, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

interface AdminSidebarProps {
  user: {
    name: string
    email: string
  }
  companyName: string
  isFullAccess: boolean
}

export function AdminSidebar({ user, companyName, isFullAccess }: AdminSidebarProps) {
  const pathname = usePathname()

  const navigation = [
    { name: 'ダッシュボード', href: '/dashboard', icon: LayoutDashboard, show: true },
    { name: '店舗管理', href: '/shops', icon: Store, show: true },
    { name: 'アンケート配布', href: '/survey', icon: Send, show: true },
    { name: '管理者', href: '/admins', icon: Users, show: isFullAccess },
    { name: 'レポート', href: '/reports', icon: BarChart3, show: true },
    { name: '全社レポート', href: '/reports/company', icon: Building2, show: isFullAccess },
  ]

  return (
    <div className="flex w-64 flex-col bg-slate-900">
      <div className="flex h-16 items-center px-6 border-b border-slate-800">
        <Logo size="md" variant="light" />
      </div>

      <div className="px-4 py-3 border-b border-slate-800">
        <p className="text-xs text-slate-500 tracking-wider">会社</p>
        <p className="text-sm font-medium text-white truncate">{companyName}</p>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navigation
          .filter((item) => item.show)
          .map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="mb-3 px-3">
          <p className="text-sm font-medium text-white truncate">{user.name}</p>
          <p className="text-xs text-slate-400 truncate">{user.email}</p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="mr-3 h-5 w-5" />
          ログアウト
        </Button>
      </div>
    </div>
  )
}
