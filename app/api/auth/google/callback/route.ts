import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { createSessionToken } from '@/lib/auth/jwt'
import { generateSecureToken } from '@/lib/utils'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  const appUrl = req.nextUrl.origin

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(error || 'Google login cancelled')}`)
  }

  let clientId = process.env.GOOGLE_CLIENT_ID
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET
  try {
    const { env } = await getCloudflareContext({ async: true })
    const cEnv = env as Record<string, string>
    if (cEnv.GOOGLE_CLIENT_ID) clientId = cEnv.GOOGLE_CLIENT_ID
    if (cEnv.GOOGLE_CLIENT_SECRET) clientSecret = cEnv.GOOGLE_CLIENT_SECRET
  } catch {}

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent('Google credentials missing in environment')}`)
  }

  const redirectUri = `${appUrl}/api/auth/google/callback`

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      console.error('[Google OAuth] Token exchange error:', errText)
      return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent('Failed to authenticate with Google')}`)
    }

    const tokens = (await tokenRes.json()) as { access_token: string; id_token: string }

    // Fetch user profile from Google
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!profileRes.ok) {
      return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent('Failed to fetch Google profile')}`)
    }

    const profile = (await profileRes.json()) as { email: string; name?: string; sub: string }

    if (!profile.email) {
      return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent('Google account has no email')}`)
    }

    const email = profile.email.toLowerCase()
    const db = await getDb()

    // Find or create user in D1
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (!user) {
      const userId = generateSecureToken(16)
      await db.insert(users).values({
        id: userId,
        email,
        passwordHash: '', // Google OAuth user
      })
      user = { id: userId, email, passwordHash: '', createdAt: new Date().toISOString() }
    }

    // Create session cookie
    const sessionToken = await createSessionToken({ userId: user.id, email: user.email })

    const res = NextResponse.redirect(`${appUrl}/dashboard`)
    res.cookies.set('notifymvp_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
    return res
  } catch (err) {
    console.error('[Google OAuth] Unexpected error:', err)
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent('Google sign in failed')}`)
  }
}
