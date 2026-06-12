import Link from 'next/link'
import { redirect } from 'next/navigation'

import { verifyAdmin } from '~/lib/admin-auth'

import { LogoutButton } from './logout-button'

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await verifyAdmin()
  if (!isAdmin) {
    redirect('/admin/login')
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <nav className="border-b border-neutral-800 bg-neutral-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold">Admin</span>
            <Link href="/admin" className="text-sm text-neutral-400 hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/admin/upload" className="text-sm text-neutral-400 hover:text-white transition-colors">
              Upload
            </Link>
            <Link href="/admin/albums" className="text-sm text-neutral-400 hover:text-white transition-colors">
              Albums
            </Link>
            <Link href="/workout" className="text-sm text-neutral-400 hover:text-white transition-colors">
              Workout
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-neutral-500 hover:text-white transition-colors">
              View Site
            </Link>
            <LogoutButton />
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
