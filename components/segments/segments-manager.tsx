'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  Plus,
  Trash2,
  Send,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  Globe,
  Smartphone,
  Clock,
  CheckCircle2,
  PauseCircle,
  HelpCircle,
  Download,
  Code,
  Check,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { createSegmentAction, deleteSegmentAction } from '@/lib/actions/segments'
import type { SegmentRuleInput } from '@/types/onesignal'

interface ProjectItem {
  id: string
  name: string
}

interface SegmentItem {
  id: string
  projectId: string
  projectName?: string
  name: string
  description?: string | null
  rules?: { id: string; field: string; operator: string; value: string }[]
  pushSubscribers?: number
  status?: string
}

interface DeviceRecord {
  id: string
  projectId: string
  projectName?: string
  userId?: string | null
  externalUserId?: string | null
  deviceId: string
  platform: string
  country?: string | null
  language?: string | null
  appVersion?: string | null
  osVersion?: string | null
  notificationPermission?: string
  status: string
  lastActive: string
}

interface SegmentsManagerProps {
  initialSegments: SegmentItem[]
  projects: ProjectItem[]
  records: DeviceRecord[]
}

const DEFAULT_PRESET_SEGMENTS: SegmentItem[] = [
  {
    id: 'preset-total',
    projectId: 'all',
    name: 'Total Subscriptions',
    description: 'Default target for all registered devices in project',
    rules: [{ id: 'r1', field: 'status', operator: 'eq', value: 'active' }],
    pushSubscribers: 0,
    status: 'Active',
  },
  {
    id: 'preset-active',
    projectId: 'all',
    name: 'Active Subscriptions',
    description: 'Last session less than 168 hours (7 days) ago',
    rules: [{ id: 'r2', field: 'lastOpen', operator: 'lt', value: '7' }],
    pushSubscribers: 0,
    status: 'Active',
  },
  {
    id: 'preset-engaged',
    projectId: 'all',
    name: 'Engaged Subscriptions',
    description: 'Active users with granted notification permissions',
    rules: [
      { id: 'r3', field: 'notificationPermission', operator: 'eq', value: 'granted' },
      { id: 'r4', field: 'lastOpen', operator: 'lt', value: '3' },
    ],
    pushSubscribers: 0,
    status: 'Active',
  },
  {
    id: 'preset-inactive',
    projectId: 'all',
    name: 'Inactive Subscriptions',
    description: 'Last session greater than 168 hours ago',
    rules: [{ id: 'r5', field: 'lastOpen', operator: 'gt', value: '7' }],
    pushSubscribers: 0,
    status: 'Active',
  },
]

export function SegmentsManager({ initialSegments, projects, records }: SegmentsManagerProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'segments' | 'users' | 'subscriptions' | 'import'>('segments')
  const [segments, setSegments] = useState<SegmentItem[]>(initialSegments)
  const [filterQuery, setFilterQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id ?? '')

  // Create Segment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [segmentName, setSegmentName] = useState('')
  const [segmentDesc, setSegmentDesc] = useState('')
  const [rules, setRules] = useState<SegmentRuleInput[]>([
    { field: 'platform', operator: 'eq', value: 'android' },
  ])

  // Merge default preset segments with custom DB segments
  const allDisplaySegments = [
    ...segments,
    ...DEFAULT_PRESET_SEGMENTS.map((p) => ({
      ...p,
      pushSubscribers: records.length,
    })),
  ]

  const filteredSegments = allDisplaySegments.filter((s) =>
    s.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(filterQuery.toLowerCase()))
  )

  const filteredRecords = records.filter(
    (r) =>
      (r.userId && r.userId.toLowerCase().includes(filterQuery.toLowerCase())) ||
      (r.externalUserId && r.externalUserId.toLowerCase().includes(filterQuery.toLowerCase())) ||
      r.deviceId.toLowerCase().includes(filterQuery.toLowerCase()) ||
      r.platform.toLowerCase().includes(filterQuery.toLowerCase())
  )

  const handleAddRule = () => {
    setRules((prev) => [...prev, { field: 'country', operator: 'eq', value: 'IN' }])
  }

  const handleRemoveRule = (index: number) => {
    if (rules.length === 1) {
      toast.error('At least one rule is required')
      return
    }
    setRules((prev) => prev.filter((_, i) => i !== index))
  }

  const handleRuleChange = (index: number, key: keyof SegmentRuleInput, val: string) => {
    setRules((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [key]: val } as SegmentRuleInput
      return updated
    })
  }

  const handleCreateSegment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProjectId) {
      toast.error('Please select a project')
      return
    }
    if (!segmentName.trim()) {
      toast.error('Segment name is required')
      return
    }

    setIsSubmitting(true)
    const res = await createSegmentAction({
      projectId: selectedProjectId,
      name: segmentName.trim(),
      description: segmentDesc.trim() || undefined,
      rules,
    })
    setIsSubmitting(false)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(`Segment "${segmentName}" created successfully!`)
      setIsModalOpen(false)
      setSegmentName('')
      setSegmentDesc('')
      setRules([{ field: 'platform', operator: 'eq', value: 'android' }])
      router.refresh()
    }
  }

  const handleQuickstartCreate = (presetName: string, presetRules: SegmentRuleInput[]) => {
    setSegmentName(presetName)
    setSegmentDesc(`Preset audience: ${presetName}`)
    setRules(presetRules)
    setIsModalOpen(true)
  }

  const handleDeleteSegment = async (segmentId: string, projectId: string) => {
    if (segmentId.startsWith('preset-')) {
      toast.error('System default segments cannot be deleted')
      return
    }
    if (!confirm('Are you sure you want to delete this segment?')) return

    const res = await deleteSegmentAction(segmentId, projectId)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Segment deleted')
      setSegments((prev) => prev.filter((s) => s.id !== segmentId))
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-[var(--primary)]" />
            Audience & Segments
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Target specific device segments based on user tags, country, platform, and session activity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Segment
          </Button>
        </div>
      </div>

      {/* Sub-Navigation Tabs (OneSignal Parity) */}
      <div className="flex items-center gap-1 border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab('segments')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'segments'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <Filter className="h-4 w-4" />
          Segments
          <span className="ml-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs">
            {allDisplaySegments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <Users className="h-4 w-4" />
          User Records
          <span className="ml-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs">
            {records.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'subscriptions'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <Smartphone className="h-4 w-4" />
          Subscriptions
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'import'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <Download className="h-4 w-4" />
          Import Users
        </button>
      </div>

      {/* SEARCH / FILTER BAR */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search by name, key, or property..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* ── TAB 1: SEGMENTS ────────────────────────────────────────────────── */}
      {activeTab === 'segments' && (
        <div className="space-y-6">
          {/* Quickstart Preset Cards (Matching OneSignal Screenshot #1) */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Quickstart Preset Audiences
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: First-time Audience */}
              <Card className="hover:border-[var(--primary)]/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    First-time Audience
                    <Clock className="h-4 w-4 text-blue-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Connect with new contacts that registered or opened in the past 24 hours.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      handleQuickstartCreate('First-time Audience', [
                        { field: 'lastOpen', operator: 'lt', value: '1' },
                      ])
                    }
                  >
                    Create
                  </Button>
                </CardContent>
              </Card>

              {/* Card 2: Active Audience */}
              <Card className="hover:border-[var(--primary)]/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    Active Audience
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Engage contacts active in the past 7 days.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      handleQuickstartCreate('Active Audience', [
                        { field: 'lastOpen', operator: 'lt', value: '7' },
                        { field: 'status', operator: 'eq', value: 'active' },
                      ])
                    }
                  >
                    Create
                  </Button>
                </CardContent>
              </Card>

              {/* Card 3: Regional Audience */}
              <Card className="hover:border-[var(--primary)]/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    Regional Audience
                    <Globe className="h-4 w-4 text-purple-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Target audience from a specified country (e.g. India or USA).
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      handleQuickstartCreate('India Audience', [
                        { field: 'country', operator: 'eq', value: 'IN' },
                      ])
                    }
                  >
                    Create
                  </Button>
                </CardContent>
              </Card>

              {/* Card 4: Custom Audience */}
              <Card className="hover:border-[var(--primary)]/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    Custom Audience
                    <Filter className="h-4 w-4 text-amber-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Build targeted filter based on device OS, App Version, or User ID.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setIsModalOpen(true)}
                  >
                    Create
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Segments Table (Matching Screenshot #1) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">All Segments</CardTitle>
                <CardDescription>
                  List of rule-based dynamic segments for target notifications
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[var(--border)] bg-[var(--muted)]/50 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
                    <tr>
                      <th className="p-3.5">Name</th>
                      <th className="p-3.5">Filter Rules</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Push Subs</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredSegments.map((s) => (
                      <tr key={s.id} className="hover:bg-[var(--accent)]/30 transition-colors">
                        <td className="p-3.5">
                          <div className="font-semibold text-[var(--foreground)]">{s.name}</div>
                          {s.description && (
                            <div className="text-xs text-[var(--muted-foreground)]">
                              {s.description}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            {s.rules && s.rules.length > 0 ? (
                              s.rules.map((r, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-xs text-[var(--muted-foreground)] font-mono"
                                >
                                  {r.field} {r.operator} "{r.value}"
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-[var(--muted-foreground)]">
                                Default (All Devices)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {s.status ?? 'Active'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-medium">{s.pushSubscribers ?? 0}</td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/dashboard/notifications?segmentId=${s.id}`)}
                              title="Send Campaign to Segment"
                            >
                              <Send className="h-4 w-4 text-[var(--primary)]" />
                            </Button>

                            {!s.id.startsWith('preset-') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSegment(s.id, s.projectId)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                title="Delete Segment"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB 2: USER RECORDS (Matching Screenshot #2) ──────────────────────── */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--primary)]" />
              User Records
            </CardTitle>
            <CardDescription>
              External user mappings, activity timestamps, and channel attributes.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] bg-[var(--muted)]/50 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
                  <tr>
                    <th className="p-3.5">Device ID / OneSignal ID</th>
                    <th className="p-3.5">External User ID</th>
                    <th className="p-3.5">Platform</th>
                    <th className="p-3.5">Country / Lang</th>
                    <th className="p-3.5">Last Active</th>
                    <th className="p-3.5">Permission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-[var(--accent)]/30 transition-colors">
                        <td className="p-3.5 font-mono text-xs font-medium text-[var(--primary)]">
                          {r.deviceId}
                        </td>
                        <td className="p-3.5 font-medium">
                          {r.externalUserId || r.userId ? (
                            <span className="rounded bg-[var(--accent)] px-2 py-0.5 text-xs font-mono">
                              {r.externalUserId || r.userId}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--muted-foreground)]">—</span>
                          )}
                        </td>
                        <td className="p-3.5 capitalize">{r.platform}</td>
                        <td className="p-3.5 text-xs text-[var(--muted-foreground)]">
                          {r.country || 'IN'} / {r.language || 'en'}
                        </td>
                        <td className="p-3.5 text-xs text-[var(--muted-foreground)]">
                          {new Date(r.lastActive).toLocaleString()}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.notificationPermission === 'granted'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-amber-500/10 text-amber-500'
                            }`}
                          >
                            {r.notificationPermission ?? 'granted'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-[var(--muted-foreground)]">
                        No user records found. Devices registering via SDK will automatically populate here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── TAB 3: SUBSCRIPTIONS (Matching Screenshot #3) ────────────────────── */}
      {activeTab === 'subscriptions' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-[var(--primary)]" />
              Subscription Records
            </CardTitle>
            <CardDescription>Live push subscription channels and device state.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] bg-[var(--muted)]/50 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
                  <tr>
                    <th className="p-3.5">Channel</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">App & OS Version</th>
                    <th className="p-3.5">FCM Token snippet</th>
                    <th className="p-3.5 text-right">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--accent)]/30 transition-colors">
                      <td className="p-3.5 capitalize font-medium flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-[var(--muted-foreground)]" />
                        {r.platform} Push
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Subscribed
                        </span>
                      </td>
                      <td className="p-3.5 text-xs text-[var(--muted-foreground)]">
                        {r.appVersion || 'v1.0.0'} ({r.osVersion || r.platform})
                      </td>
                      <td className="p-3.5 font-mono text-xs text-[var(--muted-foreground)]">
                        {r.id.slice(0, 20)}...
                      </td>
                      <td className="p-3.5 text-right text-xs text-[var(--muted-foreground)]">
                        {new Date(r.lastActive).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── TAB 4: IMPORT & SDK GUIDELINES (Matching Screenshot #5) ───────────── */}
      {activeTab === 'import' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Code className="h-4 w-4 text-[var(--primary)]" />
                SDK Auto-Sync
              </CardTitle>
              <CardDescription>
                Register users and tag properties directly via Client SDK
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-[var(--muted-foreground)]">
              <p>When a mobile or web client initializes, call the device registration API:</p>
              <pre className="rounded bg-[var(--muted)] p-3 text-[11px] font-mono text-[var(--foreground)] overflow-x-auto">
{`POST /api/device/register
{
  "appId": "YOUR_APP_ID",
  "apiKey": "YOUR_API_KEY",
  "fcmToken": "fcm_token_here",
  "platform": "android",
  "userId": "user_12345",
  "country": "IN"
}`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4 text-[var(--primary)]" />
                REST API Import
              </CardTitle>
              <CardDescription>Bulk import users or tags via Server API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-[var(--muted-foreground)]">
              <p>Create segments dynamically using standard REST endpoint:</p>
              <pre className="rounded bg-[var(--muted)] p-3 text-[11px] font-mono text-[var(--foreground)] overflow-x-auto">
{`POST /api/segments
{
  "projectId": "proj_123",
  "name": "VIP Active Users",
  "rules": [
    { "field": "country", "operator": "eq", "value": "US" }
  ]
}`}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── MODAL: CREATE NEW SEGMENT ─────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-xl bg-[var(--card)] border border-[var(--border)] p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Filter className="h-5 w-5 text-[var(--primary)]" />
                Create New Segment
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSegment} className="space-y-4">
              {/* Project Select */}
              <div className="space-y-1.5">
                <Label htmlFor="projectId">Target Project</Label>
                <Select
                  id="projectId"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  required
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Segment Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Segment Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Android Users in India"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                  required
                />
              </div>

              {/* Segment Description */}
              <div className="space-y-1.5">
                <Label htmlFor="desc">Description (Optional)</Label>
                <Input
                  id="desc"
                  placeholder="e.g. Target active users from India on Android devices"
                  value={segmentDesc}
                  onChange={(e) => setSegmentDesc(e.target.value)}
                />
              </div>

              {/* Filter Rules List */}
              <div className="space-y-3 border-t border-[var(--border)] pt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
                    Filter Rules (AND)
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddRule} className="gap-1 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add Rule
                  </Button>
                </div>

                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                  {rules.map((rule, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-2.5">
                      {/* Field */}
                      <select
                        value={rule.field}
                        onChange={(e) => handleRuleChange(idx, 'field', e.target.value)}
                        className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)] font-medium"
                      >
                        <option value="country">Country</option>
                        <option value="language">Language</option>
                        <option value="platform">Platform</option>
                        <option value="osVersion">OS Version</option>
                        <option value="appVersion">App Version</option>
                        <option value="notificationPermission">Notification Permission</option>
                        <option value="status">Status</option>
                        <option value="lastOpen">Last Open (Days)</option>
                        <option value="userId">External User ID</option>
                      </select>

                      {/* Operator */}
                      <select
                        value={rule.operator}
                        onChange={(e) => handleRuleChange(idx, 'operator', e.target.value)}
                        className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)] font-medium"
                      >
                        <option value="eq">is equal (=)</option>
                        <option value="neq">is not (!=)</option>
                        <option value="gt">greater than (&gt;)</option>
                        <option value="lt">less than (&lt;)</option>
                        <option value="contains">contains</option>
                        <option value="in">in list</option>
                      </select>

                      {/* Value */}
                      <Input
                        value={rule.value}
                        onChange={(e) => handleRuleChange(idx, 'value', e.target.value)}
                        placeholder="Value (e.g. IN, android, 7)"
                        className="h-8 text-xs flex-1"
                        required
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRule(idx)}
                        className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Save Segment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
