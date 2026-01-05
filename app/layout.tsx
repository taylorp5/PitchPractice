import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PitchPractice',
  description: 'Practice and improve your pitch presentations',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  )
}

