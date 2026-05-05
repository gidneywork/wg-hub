import './globals.css'

export const metadata = {
  title: 'WG Hub — Performance Dashboard',
  description: 'Personal training and performance tracking hub',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
