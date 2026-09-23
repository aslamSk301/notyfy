'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  Key,
  Trash2,
  Edit2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  Mail,
  FolderOpen,
  AlertTriangle,
  RefreshCw,
  MoreVertical,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  type AdminUserData,
} from '@/lib/actions/admin-users'

interface AdminUsersManagerProps {
  initialUsers: AdminUserData[]
  initialStats: {
    total: number
    googleCount: number
    credentialCount: number
    superAdminCount: number
    activeCount: number
  }
  currentAdminEmail: string
}

function generateRandomPassword(length = 12): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*'
  let pass = ''
  const array = new Uint32Array(length)
  crypto.getRandomValues(array)
  for (let i = 0; i < length; i++) {
    pass += chars[array[i] % chars.length]
  }
  return pass
}

export function AdminUsersManager({
  initialUsers,
  initialStats,
  currentAdminEmail,
}: AdminUsersManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Data & Filter State
  const [users, setUsers] = useState<AdminUserData[]>(initialUsers)
  const [search, setSearch] = useState('')
  const [providerFilter, setProviderFilter] = useState<'all' | 'google' | 'credential'>('all')
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin' | 'superadmin'>('all')

  // Modals state
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUserData | null>(null)

  // Create Form State
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<'user' | 'admin' | 'superadmin'>('user')
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [copiedPass, setCopiedPass] = useState(false)

  // Edit Form State
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<'user' | 'admin' | 'superadmin'>('user')
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active')

  // Password Reset Form State
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [copiedResetPass, setCopiedResetPass] = useState(false)

  // Synchronize when initialUsers changes
  useMemo(() => {
    setUsers(initialUsers)
  }, [initialUsers])

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase().trim()
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)

      const matchesProvider =
        providerFilter === 'all' || u.providers.includes(providerFilter)

      const matchesRole =
        roleFilter === 'all' || u.role === roleFilter

      return matchesSearch && matchesProvider && matchesRole
    })
  }, [users, search, providerFilter, roleFilter])

  // Handlers: Password Generator
  function handleGenerateCreatePassword() {
    const p = generateRandomPassword(12)
    setCreatePassword(p)
    setShowCreatePassword(true)
    navigator.clipboard.writeText(p)
    setCopiedPass(true)
    setTimeout(() => setCopiedPass(false), 2000)
    toast.success('Generated and copied password to clipboard!')
  }

  function handleGenerateResetPassword() {
    const p = generateRandomPassword(12)
    setNewPassword(p)
    setShowNewPassword(true)
    navigator.clipboard.writeText(p)
    setCopiedResetPass(true)
    setTimeout(() => setCopiedResetPass(false), 2000)
    toast.success('Generated and copied new password!')
  }

  // Handlers: Create User
  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!createEmail || !createPassword) {
      toast.error('Email and Password are required')
      return
    }

    startTransition(async () => {
      const res = await createAdminUser({
        name: createName || createEmail.split('@')[0],
        email: createEmail,
        password: createPassword,
        role: createRole,
      })

      if (res.error) {
        toast.error(res.error)
        return
      }

      toast.success(`User ${createEmail} created successfully!`)
      setCreateOpen(false)
      setCreateName('')
      setCreateEmail('')
      setCreatePassword('')
      setCreateRole('user')
      router.refresh()
    })
  }

  // Handlers: Edit User
  function openEditModal(user: AdminUserData) {
    setSelectedUser(user)
    setEditName(user.name)
    setEditEmail(user.email)
    setEditRole((user.role as 'user' | 'admin' | 'superadmin') || 'user')
    setEditStatus((user.status as 'active' | 'suspended') || 'active')
    setEditOpen(true)
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser) return

    startTransition(async () => {
      const res = await updateAdminUser({
        userId: selectedUser.id,
        name: editName,
        email: editEmail,
        role: editRole,
        status: editStatus,
      })

      if (res.error) {
        toast.error(res.error)
        return
      }

      toast.success('User updated successfully!')
      setEditOpen(false)
      setSelectedUser(null)
      router.refresh()
    })
  }

  // Handlers: Reset Password
  function openPasswordModal(user: AdminUserData) {
    setSelectedUser(user)
    const initialPass = generateRandomPassword(12)
    setNewPassword(initialPass)
    setShowNewPassword(true)
    setPasswordOpen(true)
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser || !newPassword) return

    startTransition(async () => {
      const res = await updateAdminUser({
        userId: selectedUser.id,
        password: newPassword,
      })

      if (res.error) {
        toast.error(res.error)
        return
      }

      toast.success(`Password reset for ${selectedUser.email}!`)
      setPasswordOpen(false)
      setSelectedUser(null)
      setNewPassword('')
      router.refresh()
    })
  }

  // Handlers: Delete User
  function openDeleteModal(user: AdminUserData) {
    setSelectedUser(user)
    setDeleteOpen(true)
  }

  function handleDeleteSubmit() {
    if (!selectedUser) return

    startTransition(async () => {
      const res = await deleteAdminUser(selectedUser.id)

      if (res.error) {
        toast.error(res.error)
        return
      }

      toast.success(`User ${selectedUser.email} permanently deleted from database.`)
      setDeleteOpen(false)
      setSelectedUser(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
              Super Admin · User Management
            </h1>
          </div>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Full database CRUD: view registered accounts, create users with generated credentials, manage roles, and delete accounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.refresh()}
            disabled={isPending}
            className="flex items-center gap-1.5 border-[var(--border)]"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 bg-[var(--primary)] text-white hover:opacity-90 shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Add New User
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-[var(--border)] bg-[var(--card)]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)]">Total Users</p>
              <p className="text-2xl font-bold text-[var(--foreground)] mt-0.5">{initialStats.total}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--card)]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)]">Google Logins</p>
              <p className="text-2xl font-bold text-[var(--foreground)] mt-0.5">{initialStats.googleCount}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
              </svg>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--card)]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)]">Credentials Accounts</p>
              <p className="text-2xl font-bold text-[var(--foreground)] mt-0.5">{initialStats.credentialCount}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Key className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] bg-[var(--card)]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)]">Super Admins</p>
              <p className="text-2xl font-bold text-[var(--foreground)] mt-0.5">{initialStats.superAdminCount}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search by name, email, or user ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[var(--background)] border-[var(--border)] h-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Provider Filter */}
          <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--background)] p-1 text-xs">
            <button
              onClick={() => setProviderFilter('all')}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                providerFilter === 'all'
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setProviderFilter('google')}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                providerFilter === 'google'
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              Google
            </button>
            <button
              onClick={() => setProviderFilter('credential')}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                providerFilter === 'credential'
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              Password
            </button>
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs text-[var(--foreground)] focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Super Admin</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--muted)]/40 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-4 py-3.5">Auth Provider</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Projects</th>
                <th className="px-4 py-3.5">Joined</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--muted-foreground)]">
                    <Users className="mx-auto h-8 w-8 opacity-30 mb-2" />
                    <p className="text-sm font-medium">No users found</p>
                    <p className="text-xs mt-0.5">Try adjusting your search query or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.email.toLowerCase() === currentAdminEmail.toLowerCase()
                  const isSuperAdminUser = u.role === 'superadmin' || u.role === 'admin'

                  return (
                    <tr
                      key={u.id}
                      className="group transition-colors hover:bg-[var(--accent)]/40"
                    >
                      {/* Name & Email */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {u.image ? (
                            <img
                              src={u.image}
                              alt={u.name}
                              className="h-9 w-9 rounded-full object-cover border border-[var(--border)]"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)]/15 text-[var(--primary)] font-semibold text-xs border border-[var(--primary)]/20">
                              {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-[var(--foreground)] truncate max-w-[200px]">
                                {u.name || 'Unnamed User'}
                              </span>
                              {isSelf && (
                                <span className="rounded bg-[var(--primary)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary)]">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-[var(--muted-foreground)] truncate max-w-[220px]">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Providers */}
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {u.providers.includes('google') && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-500 border border-blue-500/20">
                              <svg className="h-3 w-3" viewBox="0 0 24 24">
                                <path
                                  fill="#4285F4"
                                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                  fill="#34A853"
                                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                  fill="#FBBC05"
                                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                />
                                <path
                                  fill="#EA4335"
                                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                />
                              </svg>
                              Google
                            </span>
                          )}
                          {u.providers.includes('credential') && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500 border border-amber-500/20">
                              <Key className="h-3 w-3" />
                              Password
                            </span>
                          )}
                          {!u.providers.includes('google') && !u.providers.includes('credential') && (
                            <span className="text-xs text-[var(--muted-foreground)]">OAuth</span>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-4">
                        {isSuperAdminUser ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-500/30">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {u.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-neutral-500/10 px-2.5 py-0.5 text-xs font-medium text-[var(--muted-foreground)]">
                            User
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        {u.status === 'suspended' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500 border border-red-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        )}
                      </td>

                      {/* Projects count */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                          <FolderOpen className="h-3.5 w-3.5 opacity-70" />
                          <span>{u.projectCount} {u.projectCount === 1 ? 'project' : 'projects'}</span>
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td className="px-4 py-4 text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                              <MoreVertical className="h-4 w-4 text-[var(--muted-foreground)]" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => openEditModal(u)}
                              className="cursor-pointer"
                            >
                              <Edit2 className="mr-2 h-4 w-4" />
                              Edit User Details
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => openPasswordModal(u)}
                              className="cursor-pointer"
                            >
                              <Key className="mr-2 h-4 w-4" />
                              Reset / Set Password
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => openDeleteModal(u)}
                              disabled={isSelf}
                              className="text-[var(--destructive)] focus:text-[var(--destructive)] cursor-pointer"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Create User ──────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[var(--primary)]" />
              Create New User
            </DialogTitle>
            <DialogDescription>
              Create an account with email and password. The user will be able to log in immediately.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-name">Full Name</Label>
              <Input
                id="create-name"
                placeholder="e.g. John Doe"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-email">Email Address</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="user@example.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="create-pass">Password</Label>
                <button
                  type="button"
                  onClick={handleGenerateCreatePassword}
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                >
                  <Sparkles className="h-3 w-3" />
                  Generate Strong
                </button>
              </div>

              <div className="relative">
                <Input
                  id="create-pass"
                  type={showCreatePassword ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="pr-20"
                  required
                  minLength={6}
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {createPassword && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(createPassword)
                        setCopiedPass(true)
                        setTimeout(() => setCopiedPass(false), 2000)
                        toast.success('Password copied to clipboard!')
                      }}
                      className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      title="Copy password"
                    >
                      {copiedPass ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                You can copy and securely share this password with the user.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-role">User Role</Label>
              <select
                id="create-role"
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as any)}
                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none"
              >
                <option value="user">User (Standard Access)</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin (Full Access)</option>
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creating in DB...' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Edit User Details ────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-[var(--primary)]" />
              Edit User Details
            </DialogTitle>
            <DialogDescription>
              Update user profile information, role assignment, and account status in the database.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email Address</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-role">Role</Label>
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-status">Status</Label>
                <select
                  id="edit-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            {editStatus === 'suspended' && (
              <p className="rounded-md bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
                Suspending this user will immediately revoke all their active sessions and prevent further login.
              </p>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Updating DB...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Reset Password ───────────────────────────────────────────── */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-500" />
              Reset / Set Password
            </DialogTitle>
            <DialogDescription>
              Set or generate a new password for <strong className="text-[var(--foreground)]">{selectedUser?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePasswordSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="reset-pass">New Password</Label>
                <button
                  type="button"
                  onClick={handleGenerateResetPassword}
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                >
                  <Sparkles className="h-3 w-3" />
                  Generate Strong
                </button>
              </div>

              <div className="relative">
                <Input
                  id="reset-pass"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-20"
                  required
                  minLength={6}
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {newPassword && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(newPassword)
                        setCopiedResetPass(true)
                        setTimeout(() => setCopiedResetPass(false), 2000)
                        toast.success('Password copied to clipboard!')
                      }}
                      className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      title="Copy password"
                    >
                      {copiedResetPass ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                The user can use this password to sign in via the Email/Password form on /login.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasswordOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Updating DB...' : 'Set Password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Delete User ──────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete User Account
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{' '}
              <strong className="text-[var(--foreground)]">{selectedUser?.email}</strong> from the database?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-600 dark:text-red-400 space-y-2">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Warning: This action is irreversible!
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>User record will be permanently deleted from Cloudflare D1.</li>
              <li>All {selectedUser?.projectCount || 0} associated projects and credentials will be removed.</li>
              <li>All active user sessions and tokens will be revoked immediately.</li>
            </ul>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteSubmit}
              disabled={isPending}
            >
              {isPending ? 'Deleting from DB...' : 'Permanently Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
