import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { auth } from '@/auth'
import { Nav } from '@/components/nav'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {showNav && <Nav userRole={session!.user.role} />}
        {children}
      </body>
    </html>
  )
}
