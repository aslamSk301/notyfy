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

interface SegmentOption {
  id: string
  name: string
}

interface SendNotificationFormProps {
  projects: Project[]
  topics?:  Topic[]
  segments?: SegmentOption[]
}

const PLATFORM_TARGETS = [
  { value: 'all',     label: 'All users' },
  { value: 'android', label: 'Android' },
  { value: 'ios',     label: 'iOS' },
  { value: 'user',    label: 'Specific user (External ID)' },
]

export function SendNotificationForm({ projects, topics = [], segments = [] }: SendNotificationFormProps) {
  const router = useRouter()
  const [target, setTarget] = useState('all')
  const [formNonce, setFormNonce] = useState(0)

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
      setTarget('all')
      setFormNonce((n) => n + 1)
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

  const segmentTargets = segments.map((s) => ({
    value: `segment:${s.id}`,
    label: `🎯 Segment: ${s.name}`,
  }))

  const topicTargets = topics.map((t) => ({
    value: `topic:${t.name}`,
    label: t.description ? t.description : `Topic: ${t.name}`,
  }))

  const allTargets = [...PLATFORM_TARGETS, ...segmentTargets, ...topicTargets]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4 text-[var(--primary)]" />
          Send Notification
        </CardTitle>
        <CardDescription>
          Broadcasts go through FCM topics (all users, OS, country, app version) — not a database token scan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form key={formNonce} action={action} className="space-y-4">
          {/* Project */}
          <div className="space-y-1.5">
            <Label htmlFor="projectId">Project</Label>
            <Select id="projectId" name="projectId" required placeholder="Select a project">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>

          {/* Target — controlled so it never desyncs from the ID field */}
          <div className="space-y-1.5">
            <Label htmlFor="target">Send to</Label>
            <Select
              id="target"
              name="target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {allTargets.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>

          {target === 'user' && (
            <div className="space-y-1.5">
              <Label htmlFor="externalUserId">External User ID</Label>
              <Input
                id="externalUserId"
                name="externalUserId"
                placeholder="Paste the ID copied from Devices"
                required
              />
              <p className="text-xs text-[var(--muted-foreground)]">
                Paste the ID from the Devices page Copy button. Sends to every device registered with this user.
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

          {/* Launch URL / Action Link */}
          <div className="space-y-1.5">
            <Label htmlFor="url">Action Link / Launch URL (Optional)</Label>
            <Input
              id="url"
              name="url"
              type="url"
              placeholder="e.g. https://earnslash.com/stories/123"
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              When users click the notification, their browser or app will open this URL.
            </p>
          </div>

          {/* Image URL */}
          <div className="space-y-1.5">
            <Label htmlFor="imageUrl">Image URL (Optional)</Label>
            <Input
              id="imageUrl"
              name="imageUrl"
              type="url"
              placeholder="e.g. https://example.com/banner.jpg"
            />
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
