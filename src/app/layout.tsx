import type { Metadata } from 'next'
import { DM_Sans, Syne } from 'next/font/google'
import { auth } from '@/auth'
import { Nav } from '@/components/nav'
import './globals.css'

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
})

const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Lead Generator',
  description: 'Find local businesses that need websites',
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
      className={`${dmSans.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {showNav && <Nav userRole={session!.user.role} />}
        {children}
      </body>
    </html>
  )
}
