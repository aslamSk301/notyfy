'use client'

import { useActionState, useState } from 'react'
import { Plus, Trash2, Loader2, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { createTopic, deleteTopic } from '@/lib/actions/topics'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Project, Topic } from '@/types'

interface TopicsManagerProps {
  projects: Project[]
  topics:   (Topic & { projectName: string })[]
}

export function TopicsManager({ projects, topics }: TopicsManagerProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [state, action, isPending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await createTopic(prev, formData)
      if (result?.success) {
        toast.success('Topic created')
        router.refresh()
      }
      return result
    },
    null
  )

  async function handleDelete(topicId: string, name: string) {
    if (!confirm(`Delete topic "${name}"? Devices will no longer receive notifications sent to this topic.`)) return
    setDeletingId(topicId)
    const result = await deleteTopic(topicId)
    setDeletingId(null)
    if (result?.error) toast.error(result.error)
    else { toast.success('Topic deleted'); router.refresh() }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Create form */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="h-4 w-4 text-[var(--primary)]" />
            Create Topic
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="projectId">Project</Label>
              <Select id="projectId" name="projectId" required placeholder="Select project">
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Topic name</Label>
              <Input
                id="name" name="name"
                placeholder="e.g. cricket, breaking_news"
                required maxLength={50}
              />
              <p className="text-xs text-[var(--muted-foreground)]">
                Letters, numbers, _ and - only. No spaces.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">
                Description <span className="text-[var(--muted-foreground)]">(shown to users)</span>
              </Label>
              <Input
                id="description" name="description"
                placeholder="e.g. Live cricket scores"
                maxLength={200}
              />
            </div>

            {state?.error && (
              <p className="rounded-md bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]">
                {state.error}
              </p>
            )}

            <Button type="submit" size="sm" className="w-full" disabled={isPending || projects.length === 0}>
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create topic
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Topics list */}
      <div className="lg:col-span-2 space-y-3">
        {topics.length === 0 ? (
          <EmptyState
            icon={<Tags className="h-5 w-5" />}
            title="No topics yet"
            description="Create a topic — your app will fetch them dynamically and let users subscribe."
          />
        ) : (
          topics.map((topic) => (
            <div
              key={topic.id}
              className="flex items-start justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <code className="rounded bg-[var(--muted)] px-2 py-0.5 text-sm font-mono text-[var(--primary)]">
                    {topic.name}
                  </code>
                  <Badge variant={topic.isActive ? 'success' : 'secondary'}>
                    {topic.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {topic.projectName}
                  </Badge>
                </div>
                {topic.description && (
                  <p className="text-xs text-[var(--muted-foreground)]">{topic.description}</p>
                )}
                <p className="text-xs text-[var(--muted-foreground)]">
                  SDK: <code className="bg-[var(--muted)] px-1 rounded">NotifyMVP.subscribeToTopic("{topic.name}")</code>
                </p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                onClick={() => handleDelete(topic.id, topic.name)}
                disabled={deletingId === topic.id}
              >
                {deletingId === topic.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Trash2 className="h-4 w-4" />
                }
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
