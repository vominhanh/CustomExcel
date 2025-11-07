import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CSV to Excel Merger - Tổng hợp CSV thành Excel',
  description: 'Công cụ tổng hợp nhiều file CSV thành một file Excel duy nhất',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}


