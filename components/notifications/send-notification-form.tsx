'use client'

import { useActionState, useEffect } from 'react'
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
import type { Project } from '@/types'

interface SendNotificationFormProps {
  projects: Project[]
}

export function SendNotificationForm({ projects }: SendNotificationFormProps) {
  const router = useRouter()

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
          : 'Notification sent (no devices registered)'
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4 text-[var(--primary)]" />
          Send notification
        </CardTitle>
        <CardDescription>
          Send a push notification to all registered devices in a project.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="projectId">Project</Label>
            <Select id="projectId" name="projectId" required placeholder="Select a project">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="Notification title"
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              name="body"
              placeholder="Notification message body"
              required
              maxLength={500}
              rows={3}
            />
          </div>

          {state?.error && (
            <p className="rounded-md bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
              {state.error}
            </p>
          )}

          <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send to all devices
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
