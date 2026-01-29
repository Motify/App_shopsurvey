import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Building2 } from 'lucide-react'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'success'
    case 'ONBOARDING':
      return 'warning'
    case 'INACTIVE':
      return 'muted'
    default:
      return 'secondary'
  }
}

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    include: {
      industry: true,
      _count: {
        select: {
          shops: true,
          admins: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Companies</h1>
          <p className="text-muted-foreground">Manage all companies on the platform</p>
        </div>
        <Link href="/companies/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Company
          </Button>
        </Link>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No companies yet</h3>
            <p className="text-muted-foreground mb-4">Get started by adding your first company</p>
            <Link href="/companies/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Company
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Companies</CardTitle>
            <CardDescription>{companies.length} companies registered</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Admins</TableHead>
                  <TableHead>Shops</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/companies/${company.id}`} className="font-medium hover:underline">
                        {company.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {company.industry.nameJa}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(company.status) as 'success' | 'warning' | 'muted' | 'secondary'}>
                        {company.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{company._count.admins}</TableCell>
                    <TableCell>{company._count.shops}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(company.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
