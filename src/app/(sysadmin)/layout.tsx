import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SysAdminSidebar } from '@/components/layouts/sysadmin-sidebar'

export default async function SysAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'sysadmin') {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen">
      <SysAdminSidebar user={session.user} />
      <main className="flex-1 bg-slate-50">{children}</main>
    </div>
  )
}
