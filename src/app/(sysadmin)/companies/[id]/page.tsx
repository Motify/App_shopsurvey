import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, UserPlus, Store, Mail } from 'lucide-react'
import { ResendInviteButton } from './resend-invite-button'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getAdminStatusBadge(status: string) {
  switch (status) {
    case 'ACTIVE':
      return <Badge variant="success">Active</Badge>
    case 'PENDING':
      return <Badge variant="warning">Pending Invite</Badge>
    case 'INACTIVE':
      return <Badge variant="muted">Inactive</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default async function CompanyDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      admins: {
        orderBy: { createdAt: 'asc' },
      },
      shops: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!company) {
    notFound()
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link
          href="/companies"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Companies
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{company.name}</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-muted-foreground capitalize">
                {company.industry.toLowerCase().replace('_', ' ')}
              </span>
              <Badge
                variant={
                  company.status === 'ACTIVE'
                    ? 'success'
                    : company.status === 'ONBOARDING'
                    ? 'warning'
                    : 'muted'
                }
              >
                {company.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{company.admins.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Shops</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{company.shops.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Created</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">{formatDate(company.createdAt)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Admins Section */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Admins
              </CardTitle>
              <CardDescription>Manage company administrators</CardDescription>
            </div>
            <Link href={`/companies/${company.id}/admins/new`}>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Admin
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {company.admins.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No admins yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {company.admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.name}</TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      {admin.isFullAccess ? (
                        <Badge variant="default">Full Access</Badge>
                      ) : (
                        <Badge variant="outline">Limited</Badge>
                      )}
                    </TableCell>
                    <TableCell>{getAdminStatusBadge(admin.status)}</TableCell>
                    <TableCell>
                      {admin.status === 'PENDING' && (
                        <ResendInviteButton adminId={admin.id} adminEmail={admin.email} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Shops Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Shops
              </CardTitle>
              <CardDescription>All shop locations for this company</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {company.shops.length === 0 ? (
            <div className="text-center py-8">
              <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No shops yet</p>
              <p className="text-sm text-muted-foreground">
                Shops will be added by company admins
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {company.shops.map((shop) => (
                  <TableRow key={shop.id}>
                    <TableCell className="font-medium">{shop.name}</TableCell>
                    <TableCell>{shop.address || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={shop.status === 'ACTIVE' ? 'success' : 'muted'}>
                        {shop.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(shop.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
