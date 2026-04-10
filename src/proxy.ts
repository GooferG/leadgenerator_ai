import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Not authenticated → send to login
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Authenticated but not approved → send to pending
  if (!session.user.approved) {
    return NextResponse.redirect(new URL('/pending', req.url))
  }

  // Approved user trying to reach /admin without admin role → redirect to dashboard
  if (pathname.startsWith('/admin') && session.user.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

// Middleware runs only on these routes
export const config = {
  matcher: ['/dashboard/:path*', '/leads/:path*', '/admin/:path*'],
}
