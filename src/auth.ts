import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { supabaseAdmin } from '@/lib/supabase'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user }) {
      const email = user.email
      if (!email) return false

      // Check if this user already exists in our DB
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (!existing) {
        // First sign-in: create the user row
        const isAdmin = email === process.env.ADMIN_EMAIL
        const { error } = await supabaseAdmin.from('users').insert({
          email,
          name: user.name ?? null,
          image: user.image ?? null,
          approved: isAdmin,
          role: isAdmin ? 'admin' : 'user',
        })

        if (error) {
          console.error('Failed to create user in DB:', error)
          return false
        }
      }

      return true
    },

    async jwt({ token, trigger }) {
      // Fetch DB fields on sign-in or if not yet populated
      if (trigger === 'signIn' || token.approved === undefined) {
        const { data } = await supabaseAdmin
          .from('users')
          .select('id, approved, role')
          .eq('email', token.email as string)
          .single()

        if (data) {
          token.userId = data.id
          token.approved = data.approved
          token.role = data.role as 'user' | 'admin'
        }
      }
      return token
    },

    async session({ session, token }) {
      session.user.id = token.userId as string
      session.user.approved = token.approved as boolean
      session.user.role = token.role as 'user' | 'admin'
      return session
    },
  },
})
