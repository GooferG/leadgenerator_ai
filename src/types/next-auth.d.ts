import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      approved: boolean
      role: 'user' | 'admin'
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    approved?: boolean
    role?: 'user' | 'admin'
    userId?: string
  }
}
