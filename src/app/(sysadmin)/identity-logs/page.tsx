import { prisma } from '@/lib/prisma'
import { formatDateTime } from '@/lib/date-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Building2, Store, User } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function IdentityLogsPage() {
  const logs = await prisma.identityAccessLog.findMany({
    include: {
      sysAdmin: {
        select: {
          name: true,
          email: true,
        },
      },
      response: {
        include: {
          shop: {
            include: {
              company: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      accessedAt: 'desc',
    },
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Identity Access Log</h1>
        <p className="text-slate-500 mt-1">
          Audit trail of all identity disclosures
        </p>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500">No identity access logs yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                  Date
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                  Company / Shop
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                  Accessed By
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                  Requested By
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatDateTime(new Date(log.accessedAt))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <span className="font-medium">
                        {log.response.shop.company.name}
                      </span>
                      <span className="text-slate-400">/</span>
                      <Store className="h-4 w-4 text-slate-400" />
                      <span>{log.response.shop.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="font-medium">{log.sysAdmin.name}</p>
                        <p className="text-xs text-slate-500">{log.sysAdmin.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {log.requestedBy}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-xs">
                    <p className="truncate" title={log.reason}>
                      {log.reason}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
