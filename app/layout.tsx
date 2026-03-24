import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Volata – Scenic VFR Routes',
  description: 'Automatisch generierte Sichtflug-Routen zu den schönsten Orten Deutschlands.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full">
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body className="h-full antialiased" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif', background: '#f5f5f7', color: '#1d1d1f' }}>
        {children}
      </body>
    </html>
  )
}
