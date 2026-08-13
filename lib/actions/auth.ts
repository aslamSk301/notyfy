'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { createSessionToken } from '@/lib/auth/jwt'
import { setSessionCookie, clearSessionCookie } from '@/lib/auth/session'
import { generateSecureToken } from '@/lib/utils'

const loginSchema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const registerSchema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function login(_prev: unknown, formData: FormData) {
  const raw = {
    email:    formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const db = await getDb()

  // Find user by email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email.toLowerCase()))
    .limit(1)

  if (!user) return { error: 'Invalid email or password' }

  // Verify password
  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
  if (!valid) return { error: 'Invalid email or password' }

  // Create JWT session
  const token = await createSessionToken({ userId: user.id, email: user.email })
  await setSessionCookie(token)

  redirect('/dashboard')
}

export async function register(_prev: unknown, formData: FormData) {
  const raw = {
    email:    formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const parsed = registerSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const db = await getDb()

  // Check for existing user
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email.toLowerCase()))
    .limit(1)

  if (existing) return { error: 'An account with this email already exists' }

  // Hash password (cost=12 for production)
  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  // Create user
  const userId = generateSecureToken(16)
  await db.insert(users).values({
    id:           userId,
    email:        parsed.data.email.toLowerCase(),
    passwordHash,
  })

  // Auto sign-in
  const token = await createSessionToken({
    userId,
    email: parsed.data.email.toLowerCase(),
  })
  await setSessionCookie(token)

  redirect('/dashboard')
}

export async function logout() {
  await clearSessionCookie()
  redirect('/login')
}
