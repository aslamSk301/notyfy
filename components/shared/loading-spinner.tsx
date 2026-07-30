import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  className?: string
  size?: number
}

export function LoadingSpinner({ className, size = 16 }: LoadingSpinnerProps) {
  return (
    <Loader2
      className={cn('animate-spin text-[var(--muted-foreground)]', className)}
      style={{ width: size, height: size }}
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex h-full min-h-[400px] items-center justify-center">
      <LoadingSpinner size={32} />
    </div>
  )
}
