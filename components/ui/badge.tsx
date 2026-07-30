import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--primary)] text-[var(--primary-foreground)]',
        secondary:
          'border-transparent bg-[var(--secondary)] text-[var(--secondary-foreground)]',
        destructive:
          'border-transparent bg-[var(--destructive)] text-[var(--destructive-foreground)]',
        outline:
          'text-[var(--foreground)] border-[var(--border)]',
        success:
          'border-transparent bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        warning:
          'border-transparent bg-amber-500/20 text-amber-400 border-amber-500/30',
        error:
          'border-transparent bg-red-500/20 text-red-400 border-red-500/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
