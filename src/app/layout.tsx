import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { auth } from '@/auth'
import { Nav } from '@/components/nav'
import './globals.css'

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Hook',
  description: 'Stop pitching. Start hooking.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const showNav = session?.user?.approved === true

  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {showNav && <Nav userRole={session!.user.role} />}
        {children}
      </body>
    </html>
  )
}
