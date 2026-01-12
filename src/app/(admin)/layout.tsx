import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminSidebar } from '@/components/layouts/admin-sidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'admin') {
    redirect('/companies')
  }

  // Get company info for the admin
  const admin = await prisma.admin.findUnique({
    where: { id: session.user.id },
    include: { company: true },
  })

  if (!admin) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        user={session.user}
        companyName={admin.company.name}
        isFullAccess={admin.isFullAccess}
      />
      <main className="flex-1 bg-slate-50">{children}</main>
    </div>
  )
}
