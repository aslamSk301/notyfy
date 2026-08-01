import { getAllDevices } from '@/lib/actions/devices'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Smartphone, Wifi, WifiOff } from 'lucide-react'
import { formatDate, maskApiKey } from '@/lib/utils'

export const metadata = { title: 'Devices' }

const PLATFORM_ICONS: Record<string, string> = {
  android:       '🤖',
  ios:           '🍎',
  flutter:       '💙',
  'react-native':'⚛️',
}

export default async function DevicesPage() {
  const { devices, error } = await getAllDevices()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--foreground)]">Devices</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            All registered devices across your projects
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {devices.length} device{devices.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {error && (
        <p className="rounded-md bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}

      {devices.length === 0 ? (
        <EmptyState
          icon={<Smartphone className="h-6 w-6" />}
          title="No devices registered yet"
          description="Devices appear here when your mobile app calls the registration API."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/50">
                {['Platform', 'Device', 'OS', 'App Version', 'Project', 'Topics', 'Status', 'Last Active'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {devices.map((device) => (
                <tr key={device.id} className="bg-[var(--card)] hover:bg-[var(--muted)]/20 transition-colors">

                  {/* Platform */}
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-[var(--foreground)]">
                      <span>{PLATFORM_ICONS[device.platform] ?? '📱'}</span>
                      <span className="capitalize">{device.platform}</span>
                    </span>
                  </td>

                  {/* Device model */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-[var(--foreground)] font-medium">
                        {device.deviceModel ?? '—'}
                      </p>
                      {device.externalUserId && (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          User: {device.externalUserId}
                        </p>
                      )}
                      <p className="text-xs text-[var(--muted-foreground)] font-mono">
                        {device.deviceId.slice(0, 16)}…
                      </p>
                    </div>
                  </td>

                  {/* OS */}
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {device.deviceOs ?? '—'}
                  </td>

                  {/* App version */}
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {device.appVersion ?? '—'}
                  </td>

                  {/* Project */}
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {device.projectName}
                    </Badge>
                  </td>

                  {/* Topics */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {device.topicNames.length > 0
                        ? device.topicNames.map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs px-1.5 py-0">
                              {t}
                            </Badge>
                          ))
                        : <span className="text-xs text-[var(--muted-foreground)]">—</span>
                      }
                    </div>
                  </td>

                  {/* Subscription status */}
                  <td className="px-4 py-3">
                    {device.subscriptionStatus === 'subscribed' ? (
                      <span className="flex items-center gap-1 text-emerald-400 text-xs">
                        <Wifi className="h-3 w-3" /> Subscribed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[var(--muted-foreground)] text-xs">
                        <WifiOff className="h-3 w-3" /> Unsubscribed
                      </span>
                    )}
                  </td>

                  {/* Last active */}
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                    {device.lastActive ? formatDate(device.lastActive) : formatDate(device.createdAt)}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
