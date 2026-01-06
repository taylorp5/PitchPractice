import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'PitchPractice - Practice your pitch. Get precise feedback.',
  description: 'Practice and improve your pitch presentations with AI-powered feedback',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased flex flex-col">
        <Navbar />
        <main className="min-h-[calc(100vh-4rem)] flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}

