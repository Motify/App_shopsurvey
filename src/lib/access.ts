import { prisma } from '@/lib/prisma'

/**
 * Gets all shop IDs accessible to an admin.
 * - Full Access admins: all company shops
 * - Limited admins: assigned shops + all descendants (recursive)
 */
export async function getAccessibleShopIds(
  adminId: string
): Promise<{ shopIds: string[]; isFullAccess: boolean; companyId: string | null }> {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: {
      shopAssignments: { select: { shopId: true } },
    },
  })

  if (!admin) {
    return { shopIds: [], isFullAccess: false, companyId: null }
  }

  if (admin.isFullAccess) {
    const shops = await prisma.shop.findMany({
      where: { companyId: admin.companyId },
      select: { id: true },
    })
    return {
      shopIds: shops.map((s) => s.id),
      isFullAccess: true,
      companyId: admin.companyId,
    }
  }

  // Limited access: get assigned shops and all descendants
  const assignedShopIds = admin.shopAssignments.map((a) => a.shopId)
  const allAccessibleIds = new Set<string>(assignedShopIds)

  const getChildrenIds = async (parentIds: string[]): Promise<void> => {
    if (parentIds.length === 0) return
    const children = await prisma.shop.findMany({
      where: { parentId: { in: parentIds } },
      select: { id: true },
    })
    const childIds = children.map((c) => c.id)
    childIds.forEach((id) => allAccessibleIds.add(id))
    if (childIds.length > 0) {
      await getChildrenIds(childIds)
    }
  }

  await getChildrenIds(assignedShopIds)

  return {
    shopIds: Array.from(allAccessibleIds),
    isFullAccess: false,
    companyId: admin.companyId,
  }
}

/**
 * Checks if an admin has access to a specific shop
 */
export async function hasShopAccess(
  adminId: string,
  shopId: string
): Promise<boolean> {
  const { shopIds, isFullAccess } = await getAccessibleShopIds(adminId)
  if (isFullAccess) return true
  return shopIds.includes(shopId)
}

/**
 * Gets descendant shop IDs for given parent shop IDs
 */
export async function getDescendantShopIds(parentIds: string[]): Promise<string[]> {
  const descendants = new Set<string>()

  const getChildren = async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return
    const children = await prisma.shop.findMany({
      where: { parentId: { in: ids } },
      select: { id: true },
    })
    const childIds = children.map((c) => c.id)
    childIds.forEach((id) => descendants.add(id))
    if (childIds.length > 0) {
      await getChildren(childIds)
    }
  }

  await getChildren(parentIds)
  return Array.from(descendants)
}
