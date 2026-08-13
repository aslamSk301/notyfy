import { getProjects } from '@/lib/actions/projects'
import { ApiKeysManager } from '@/components/api-keys/api-keys-manager'

export const metadata = { title: 'REST API Keys & Docs' }

export default async function ApiKeysPage() {
  const { projects = [] } = await getProjects()

  return (
    <div className="container mx-auto py-6">
      <ApiKeysManager projects={projects} />
    </div>
  )
}
