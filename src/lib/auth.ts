import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export type UserRole = 'sysadmin' | 'admin'

declare module 'next-auth' {
  interface User {
    role: UserRole
    companyId?: string
    isFullAccess?: boolean
  }
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      companyId?: string
      isFullAccess?: boolean
    }
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    role: UserRole
    companyId?: string
    isFullAccess?: boolean
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string

        // Check SysAdmin first
        const sysAdmin = await prisma.sysAdmin.findUnique({
          where: { email },
        })

        if (sysAdmin) {
          const isValid = await bcrypt.compare(password, sysAdmin.passwordHash)
          if (isValid) {
            return {
              id: sysAdmin.id,
              email: sysAdmin.email,
              name: sysAdmin.name,
              role: 'sysadmin' as UserRole,
            }
          }
        }

        // Check Admin
        const admin = await prisma.admin.findUnique({
          where: { email },
        })

        if (admin && admin.passwordHash && admin.status === 'ACTIVE') {
          const isValid = await bcrypt.compare(password, admin.passwordHash)
          if (isValid) {
            return {
              id: admin.id,
              email: admin.email,
              name: admin.name,
              role: 'admin' as UserRole,
              companyId: admin.companyId,
              isFullAccess: admin.isFullAccess,
            }
          }
        }

        return null
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.companyId = user.companyId
        token.isFullAccess = user.isFullAccess
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string
        session.user.role = token.role
        session.user.companyId = token.companyId
        session.user.isFullAccess = token.isFullAccess
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  trustHost: true,
})
