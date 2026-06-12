import '../admin/globals.css'

export default function WorkoutRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-white antialiased">{children}</body>
    </html>
  )
}
