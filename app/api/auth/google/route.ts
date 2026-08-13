import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function GET(req: NextRequest) {
  let clientId = process.env.GOOGLE_CLIENT_ID
  try {
    const { env } = await getCloudflareContext({ async: true })
    if ((env as Record<string, string>).GOOGLE_CLIENT_ID) {
      clientId = (env as Record<string, string>).GOOGLE_CLIENT_ID
    }
  } catch {}

  const origin = req.nextUrl.origin
  if (!clientId) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Google Client ID is not configured in env (GOOGLE_CLIENT_ID)')}`)
  }

  const redirectUri = `${origin}/api/auth/google/callback`

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  googleAuthUrl.searchParams.set('client_id', clientId)
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri)
  googleAuthUrl.searchParams.set('response_type', 'code')
  googleAuthUrl.searchParams.set('scope', 'openid email profile')
  googleAuthUrl.searchParams.set('access_type', 'offline')
  googleAuthUrl.searchParams.set('prompt', 'consent')

  return NextResponse.redirect(googleAuthUrl.toString())
}
