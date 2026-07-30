'use client'

import { useActionState, useRef, useState } from 'react'
import { Plus, Loader2, Upload, FileJson } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createProject } from '@/lib/actions/projects'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function CreateProjectDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const [state, action, isPending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await createProject(prev, formData)
      if (result?.success) {
        toast.success('Project created successfully')
        setOpen(false)
        setFileName(null)
        formRef.current?.reset()
        router.refresh()
      }
      return result
    },
    null
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Add a new project to start sending push notifications.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              name="name"
              placeholder="My Mobile App"
              required
              maxLength={80}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="firebaseJson">
              Firebase Service Account JSON{' '}
              <span className="text-[var(--muted-foreground)]">(optional — can add later)</span>
            </Label>
            <div
              className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-[var(--border)] p-3 transition-colors hover:border-[var(--primary)]/50"
              onClick={() => fileInputRef.current?.click()}
            >
              {fileName ? (
                <FileJson className="h-5 w-5 shrink-0 text-emerald-400" />
              ) : (
                <Upload className="h-5 w-5 shrink-0 text-[var(--muted-foreground)]" />
              )}
              <span className="text-sm text-[var(--muted-foreground)]">
                {fileName ?? 'Click to upload JSON file'}
              </span>
            </div>
            <input
              ref={fileInputRef}
              id="firebaseJson"
              name="firebaseJson"
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </div>

          {state?.error && (
            <p className="rounded-md bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
