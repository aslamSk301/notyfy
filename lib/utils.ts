import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes safely, resolving conflicts */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Generate a cryptographically secure random hex string of given byte length */
export function generateSecureToken(byteLength = 32): string {
  const array = new Uint8Array(byteLength)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Generate a short unique App ID (e.g. "app_a3f9bc12") */
export function generateAppId(): string {
  const array = new Uint8Array(8)
  crypto.getRandomValues(array)
  const hex = Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `app_${hex}`
}

/** Format a date string to a human-readable format */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Truncate a string to a max length with ellipsis */
export function truncate(str: string, maxLength = 40): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '…'
}

/** Mask an API key, showing only the last 6 chars */
export function maskApiKey(key: string): string {
  if (key.length <= 6) return '••••••'
  return '••••••••••••••••••••' + key.slice(-6)
}
