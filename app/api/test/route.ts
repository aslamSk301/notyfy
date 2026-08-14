import { NextResponse } from 'next/server'

export async function GET() {
  let cfEnv: any = {}
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = await getCloudflareContext({ async: true })
    cfEnv = env || {}
  } catch {}

  return NextResponse.json({
    keys: Object.keys(process.env).concat(Object.keys(cfEnv)),
    hasSecret: !!process.env.BETTER_AUTH_SECRET || !!cfEnv.BETTER_AUTH_SECRET,
    hasClientId: !!process.env.GOOGLE_CLIENT_ID || !!cfEnv.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET || !!cfEnv.GOOGLE_CLIENT_SECRET,
    hasApiKey: !!process.env.BETTER_AUTH_API_KEY || !!cfEnv.BETTER_AUTH_API_KEY,
  })
}
