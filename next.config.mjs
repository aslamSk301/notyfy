import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

// Initialize OpenNext Cloudflare adapter in development
// so that D1/R2 bindings work locally via `wrangler dev`
initOpenNextCloudflareForDev()

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Firebase Admin SDK must not be bundled for client
  serverExternalPackages: ['firebase-admin'],
}

export default nextConfig
