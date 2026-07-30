import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { User, Shield, Code } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Settings</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Manage your account and platform settings
        </p>
      </div>

      {/* Account info */}
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
            <p className="text-sm font-medium text-[var(--foreground)]">{user?.email}</p>
          </div>
          <Separator />
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted-foreground)]">Account ID</p>
            <p className="font-mono text-xs text-[var(--muted-foreground)]">{user?.id}</p>
          </div>
          <Separator />
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted-foreground)]">Member since</p>
            <p className="text-sm text-[var(--foreground)]">
              {user?.created_at ? formatDate(user.created_at) : '—'}
            </p>
          </div>
          <Separator />
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted-foreground)]">Email verified</p>
            {user?.email_confirmed_at ? (
              <Badge variant="success">Verified</Badge>
            ) : (
              <Badge variant="warning">Unverified</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-[var(--primary)]" />
            Security
          </CardTitle>
          <CardDescription>Authentication provider and security settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted-foreground)]">Auth provider</p>
            <Badge variant="secondary">Email / Password</Badge>
          </div>
          <Separator />
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted-foreground)]">Last sign-in</p>
            <p className="text-sm text-[var(--foreground)]">
              {user?.last_sign_in_at ? formatDate(user.last_sign_in_at) : '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* SDK Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Code className="h-4 w-4 text-[var(--primary)]" />
            SDK Integration
          </CardTitle>
          <CardDescription>How to register devices from your mobile app</CardDescription>
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
  "appId": "<your-app-id>",
  "apiKey": "<your-api-key>",
  "fcmToken": "<firebase-cloud-messaging-token>",
  "platform": "android" | "ios" | "flutter" | "react-native",
  "deviceId": "<unique-device-identifier>",
  "appVersion": "1.0.0"  // optional
}`}</code>
            </pre>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--foreground)]">Example Response</p>
            <pre className="overflow-x-auto rounded-md bg-[var(--muted)] p-4 text-xs text-[var(--foreground)]">
              <code>{`{
  "success": true,
  "message": "Device registered successfully"
}`}</code>
            </pre>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            Find your App ID and API Key in the Projects section. The API key authenticates your
            mobile app — keep it secure and never expose it in client-side code beyond your mobile
            binary.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
