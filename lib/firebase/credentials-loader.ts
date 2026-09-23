/**
 * Unified Firebase Credentials Loader
 * Handles AES-256-GCM encrypted credentials stored in Cloudflare D1 with
 * seamless, zero-downtime backward-compatible fallback (lazy migration) from R2.
 */

import { decryptText, encryptText } from '@/lib/crypto/encryption'
import { downloadFromR2 } from '@/lib/r2/client'
import { getDb } from '@/lib/db/client'
import { projects } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { FirebaseServiceAccount } from '@/lib/firebase/fcm-client'

export interface ProjectCredentialsTarget {
  id: string
  firebaseCredentials?: string | null
  firebaseJsonPath?: string | null
}

/** Check if project has credentials configured (either in D1 or legacy R2) */
export function hasFirebaseCredentials(project?: ProjectCredentialsTarget | null): boolean {
  if (!project) return false
  return Boolean(project.firebaseCredentials || project.firebaseJsonPath)
}

/**
 * Load and parse Firebase credentials for a project.
 * 1. Checks encrypted `firebaseCredentials` in D1.
 * 2. If missing, falls back to legacy R2 `firebaseJsonPath`, downloads it,
 *    automatically encrypts it, updates D1 (lazy migration), and returns the credentials.
 */
export async function getProjectCredentials(
  project: ProjectCredentialsTarget
): Promise<FirebaseServiceAccount | null> {
  // 1. Primary: Encrypted in D1
  if (project.firebaseCredentials) {
    try {
      const decrypted = await decryptText(project.firebaseCredentials)
      return JSON.parse(decrypted) as FirebaseServiceAccount
    } catch (err) {
      console.error(`[credentials-loader] Failed to decrypt credentials for project ${project.id}:`, err)
    }
  }

  // 2. Fallback / Lazy Migration: Legacy R2 path
  if (project.firebaseJsonPath) {
    try {
      const fileContent = await downloadFromR2(project.firebaseJsonPath)
      if (fileContent) {
        const parsed = JSON.parse(fileContent) as FirebaseServiceAccount

        // Auto-migrate on-the-fly to D1 in background
        try {
          const encrypted = await encryptText(fileContent)
          const db = await getDb()
          await db
            .update(projects)
            .set({ firebaseCredentials: encrypted })
            .where(eq(projects.id, project.id))
          console.info(`[credentials-loader] Successfully migrated project ${project.id} credentials from R2 to D1`)
        } catch (migrationErr) {
          console.warn(`[credentials-loader] Failed to save lazy migration for project ${project.id}:`, migrationErr)
        }

        return parsed
      }
    } catch (r2Err) {
      console.error(`[credentials-loader] Failed to fetch legacy credentials from R2 for project ${project.id}:`, r2Err)
    }
  }

  return null
}
