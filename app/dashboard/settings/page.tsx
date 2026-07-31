import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { User, Shield, Code } from 'lucide-react'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Settings</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Manage your account and platform settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-[var(--primary)]" />
            Account
          </CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted-foreground)]">Email address</p>
            <p className="text-sm font-medium text-[var(--foreground)]">{session.email}</p>
          </div>
          <Separator />
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted-foreground)]">Account ID</p>
            <p className="font-mono text-xs text-[var(--muted-foreground)]">{session.userId}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-[var(--primary)]" />
            Infrastructure
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted-foreground)]">Database</p>
            <Badge variant="secondary">Cloudflare D1 (SQLite)</Badge>
          </div>
          <Separator />
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted-foreground)]">Storage</p>
            <Badge variant="secondary">Cloudflare R2</Badge>
          </div>
          <Separator />
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted-foreground)]">Hosting</p>
            <Badge variant="secondary">Cloudflare Pages</Badge>
          </div>
          <Separator />
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted-foreground)]">Auth</p>
            <Badge variant="secondary">JWT (HS256, 7-day session)</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Code className="h-4 w-4 text-[var(--primary)]" />
            SDK Integration
          </CardTitle>
          <CardDescription>Device registration API reference</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--foreground)]">
              Device Registration Endpoint
            </p>
            <pre className="overflow-x-auto rounded-md bg-[var(--muted)] p-4 text-xs text-[var(--foreground)]">
              <code>{`POST /api/device/register
Content-Type: application/json

{
  "appId":      "<your-app-id>",
  "apiKey":     "<your-api-key>",
  "fcmToken":   "<firebase-cloud-messaging-token>",
  "platform":   "android" | "ios" | "flutter" | "react-native",
  "deviceId":   "<unique-device-identifier>",
  "appVersion": "1.0.0"  // optional
}`}</code>
            </pre>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--foreground)]">Response</p>
            <pre className="overflow-x-auto rounded-md bg-[var(--muted)] p-4 text-xs text-[var(--foreground)]">
              <code>{`{ "success": true, "message": "Device registered successfully" }`}</code>
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
