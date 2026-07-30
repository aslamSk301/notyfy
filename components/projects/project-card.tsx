'use client'

import { useState, useRef } from 'react'
import { MoreVertical, Pencil, Trash2, Upload, FileJson, Loader2, Check } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CopyButton } from '@/components/shared/copy-button'
import { deleteProject, updateProject, updateFirebaseJson } from '@/lib/actions/projects'
import { maskApiKey, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Project } from '@/types'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editName, setEditName] = useState(project.name)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleDelete() {
    setIsDeleting(true)
    const result = await deleteProject(project.id)
    setIsDeleting(false)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('Project deleted')
      setDeleteOpen(false)
      router.refresh()
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setIsEditing(true)
    const formData = new FormData()
    formData.set('id', project.id)
    formData.set('name', editName)
    const result = await updateProject(null, formData)
    setIsEditing(false)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('Project updated')
      setEditOpen(false)
      router.refresh()
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    const result = await updateFirebaseJson(project.id, file)
    setIsUploading(false)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('Firebase credentials updated')
      router.refresh()
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{project.name}</CardTitle>
            <CardDescription className="text-xs">
              Created {formatDate(project.created_at)}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit name
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Firebase JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[var(--destructive)] focus:text-[var(--destructive)]"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* App ID */}
          <div className="rounded-md bg-[var(--muted)] p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                App ID
              </p>
              <CopyButton value={project.app_id} />
            </div>
            <p className="mt-1 font-mono text-sm text-[var(--foreground)]">{project.app_id}</p>
          </div>

          {/* API Key */}
          <div className="rounded-md bg-[var(--muted)] p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                API Key
              </p>
              <CopyButton value={project.api_key} />
            </div>
            <p className="mt-1 font-mono text-sm text-[var(--foreground)]">
              {maskApiKey(project.api_key)}
            </p>
          </div>

          {/* Firebase credentials status */}
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-[var(--muted-foreground)]" />
            <span className="text-xs text-[var(--muted-foreground)]">Firebase credentials:</span>
            {project.firebase_json_path ? (
              <Badge variant="success">
                <Check className="mr-1 h-3 w-3" />
                Configured
              </Badge>
            ) : (
              <Badge variant="warning">Not uploaded</Badge>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-0">
          {isUploading && (
            <p className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Uploading credentials…
            </p>
          )}
        </CardFooter>
      </Card>

      {/* Hidden file input for Firebase JSON upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>Update the project name.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Project name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                maxLength={80}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={isEditing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isEditing}>
                {isEditing && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              This will permanently delete{' '}
              <span className="font-semibold text-[var(--foreground)]">{project.name}</span>{' '}
              and all its devices and notification history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
