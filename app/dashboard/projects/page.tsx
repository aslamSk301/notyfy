import { getProjects } from '@/lib/actions/projects'
import { ProjectCard } from '@/components/projects/project-card'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { FolderOpen } from 'lucide-react'

export const metadata = { title: 'Projects' }

export default async function ProjectsPage() {
  const { projects, error } = await getProjects()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--foreground)]">Projects</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Manage your push notification projects
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      {error && (
        <p className="rounded-md bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
          Failed to load projects: {error}
        </p>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-6 w-6" />}
          title="No projects yet"
          description="Create a project to get your App ID, API Key, and start sending push notifications."
          action={<CreateProjectDialog />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
