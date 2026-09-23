'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FolderOpen,
  Bell,
  Settings,
  Zap,
  Users,
  Smartphone,
  Key,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const baseNavItems: NavItem[] = [
  { href: '/dashboard',               label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/dashboard/projects',      label: 'Projects',      icon: FolderOpen },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/devices',       label: 'Devices',       icon: Smartphone },
  { href: '/dashboard/segments',      label: 'Segments',      icon: Users },
  { href: '/dashboard/api-keys',      label: 'API Keys & Docs', icon: Key },
  { href: '/dashboard/settings',      label: 'Settings',      icon: Settings },
]

interface SidebarProps {
  isSuperAdmin?: boolean
}

export function Sidebar({ isSuperAdmin = false }: SidebarProps) {
  const pathname = usePathname()

  const navItems = [
    ...baseNavItems,
    ...(isSuperAdmin
      ? [
          {
            href: '/dashboard/admin',
            label: 'Super Admin',
            icon: ShieldCheck,
            badge: 'Admin',
          },
        ]
      : []),
  ]

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[var(--sidebar-width)] flex-col border-r border-[var(--border)] bg-[var(--card)]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-[var(--border)] px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-semibold text-[var(--foreground)]">NotifyMVP</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 p-3 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const isActive =
            href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </div>
              {badge && (
                <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border)] p-3">
        <p className="px-3 py-1 text-xs text-[var(--muted-foreground)]">
          v1.0.0 · MVP
        </p>
      </div>
    </aside>
  )
}

