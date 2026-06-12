import { isAdmin } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'

import { readAppsManifest } from '@/lib/ios-apps'
import { r2PublicUrl } from '@/lib/r2-storage'

export const dynamic = 'force-dynamic'

function formatSize(bytes: number): string {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

export default async function AppsPage() {
  const admin = await isAdmin()
  if (!admin) redirect('/admin')

  const { apps } = await readAppsManifest()
  const sorted = [...apps].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">iOS Apps</h1>
      <p className="text-sm text-gray-500 mb-8">
        Install on your provisioned iPhone. Open this page in Safari on the device, then tap Install.
      </p>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500">No builds yet. Run <code>deploy-ios.sh</code> on your Mac.</p>
      ) : (
        <ul className="space-y-4">
          {sorted.map((app) => {
            const installUrl = `itms-services://?action=download-manifest&url=https://andypandy.org/api/ios/${app.slug}/manifest.plist`
            return (
              <li key={app.slug} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  {app.iconKey && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r2PublicUrl(app.iconKey)} alt="" className="h-12 w-12 rounded-lg" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{app.appName}</p>
                    <p className="text-xs text-gray-500">
                      v{app.version} ({app.build}) · {formatSize(app.sizeBytes)} ·{' '}
                      {new Date(app.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <a
                    href={installUrl}
                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
                  >
                    Install
                  </a>
                  <a href={r2PublicUrl(app.ipaKey)} className="text-sm text-gray-500 hover:text-gray-800">
                    Download .ipa
                  </a>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
