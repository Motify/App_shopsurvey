'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Building2, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

interface SysAdminSidebarProps {
  user: {
    name: string
    email: string
  }
}

const navigation = [
  { name: 'Companies', href: '/companies', icon: Building2 },
]

export function SysAdminSidebar({ user }: SysAdminSidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex w-64 flex-col bg-[#28cc8f]">
      <div className="flex h-16 items-center px-6 border-b border-[#20b87d]">
        <Logo size="md" variant="light" />
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-[#20b87d] p-4">
        <div className="mb-3 px-3">
          <p className="text-sm font-medium text-white truncate">{user.name}</p>
          <p className="text-xs text-white/70 truncate">{user.email}</p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Logout
        </Button>
      </div>
    </div>
  )
}
