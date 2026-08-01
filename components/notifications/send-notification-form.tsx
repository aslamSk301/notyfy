'use client'

import { useActionState, useEffect, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { sendNotification } from '@/lib/actions/notifications'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Project, Topic } from '@/types'

interface SendNotificationFormProps {
  projects: Project[]
  topics?:  Topic[]
}

const PLATFORM_TARGETS = [
  { value: 'all',          label: '📢 All devices' },
  { value: 'android',      label: '🤖 Android only' },
  { value: 'ios',          label: '🍎 iOS only' },
  { value: 'flutter',      label: '💙 Flutter only' },
  { value: 'react-native', label: '⚛️ React Native only' },
  { value: 'user',         label: '👤 Specific user (External ID)' },
]

export function SendNotificationForm({ projects, topics = [] }: SendNotificationFormProps) {
  const router = useRouter()
  const [target, setTarget] = useState('all')

  const [state, action, isPending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await sendNotification(prev, formData)
      return result
    },
    null
  )

  useEffect(() => {
    if (state?.success) {
      const count = state.recipientCount ?? 0
      toast.success(
        count > 0
          ? `Notification sent to ${count} device${count === 1 ? '' : 's'}`
          : 'Notification sent'
      )
      router.refresh()
    }
  }, [state, router])

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            Create a project first before sending notifications.
          </p>
        </CardContent>
      </Card>
    )
  }

  const topicTargets = topics.map((t) => ({
    value: `topic:${t.name}`,
    label: `🏷️ Topic: ${t.name}`,
  }))

  const allTargets = [...PLATFORM_TARGETS, ...topicTargets]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4 text-[var(--primary)]" />
          Send notification
        </CardTitle>
        <CardDescription>
          Send to all devices, a platform, a specific user, or a custom topic.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {/* Project */}
          <div className="space-y-1.5">
            <Label htmlFor="projectId">Project</Label>
            <Select id="projectId" name="projectId" required placeholder="Select a project">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>

          {/* Target */}
          <div className="space-y-1.5">
            <Label htmlFor="target">Send to</Label>
            <Select
              id="target"
              name="target"
              defaultValue="all"
              onChange={(e) => setTarget(e.target.value)}
            >
              {allTargets.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>

          {/* External User ID — shown only when target = 'user' */}
          {target === 'user' && (
            <div className="space-y-1.5">
              <Label htmlFor="externalUserId">External User ID</Label>
              <Input
                id="externalUserId"
                name="externalUserId"
                placeholder="e.g. user_9847 or ahmed@gmail.com"
                required
              />
              <p className="text-xs text-[var(--muted-foreground)]">
                The ID you assigned via <code className="bg-[var(--muted)] px-1 rounded">NotifyMVP.setExternalUserId()</code> in your app.
                Sends to ALL devices registered with this user.
              </p>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="Notification title" required maxLength={100} />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="body">Message</Label>
            <Textarea id="body" name="body" placeholder="Notification message body" required maxLength={500} rows={3} />
          </div>

          {state?.error && (
            <p className="rounded-md bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
              {state.error}
            </p>
          )}

          <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
            ) : (
              <><Send className="h-4 w-4" />Send notification</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
