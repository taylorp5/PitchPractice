/**
 * Environment variable sanity check helper (server-only)
 * Logs boolean status of required env vars without exposing secrets
 * Only runs in development/local environments
 */

const REQUIRED_ENV_VARS = {
  // Public (safe to log presence)
  public: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ],
  // Private (only log presence, never values)
  private: [
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
  ],
} as const

export function checkEnvVars(): {
  allPresent: boolean
  missing: string[]
  status: Record<string, boolean>
} {
  const status: Record<string, boolean> = {}
  const missing: string[] = []

  // Check public vars
  for (const varName of REQUIRED_ENV_VARS.public) {
    const isPresent = !!process.env[varName]
    status[varName] = isPresent
    if (!isPresent) {
      missing.push(varName)
    }
  }

  // Check private vars (only presence, never values)
  for (const varName of REQUIRED_ENV_VARS.private) {
    const isPresent = !!process.env[varName]
    status[varName] = isPresent
    if (!isPresent) {
      missing.push(varName)
    }
  }

  return {
    allPresent: missing.length === 0,
    missing,
    status,
  }
}

/**
 * Log env var status (only in dev/local, never in production)
 */
export function logEnvStatus(): void {
  // Only log in development or when explicitly enabled
  const isDev = process.env.NODE_ENV === 'development'
  const forceCheck = process.env.FORCE_ENV_CHECK === 'true'
  
  if (!isDev && !forceCheck) {
    return // Silent in production
  }

  const { allPresent, missing, status } = checkEnvVars()

  console.log('\n[Env Check] Environment Variables Status:')
  console.log('─'.repeat(50))
  
  for (const [varName, isPresent] of Object.entries(status)) {
    const icon = isPresent ? '✓' : '✗'
    const label = isPresent ? 'Set' : 'Missing'
    console.log(`  ${icon} ${varName}: ${label}`)
  }
  
  console.log('─'.repeat(50))
  
  if (allPresent) {
    console.log('✓ All required environment variables are present\n')
  } else {
    console.error(`✗ Missing ${missing.length} environment variable(s): ${missing.join(', ')}\n`)
    if (isDev) {
      console.error('Please check your .env.local file and ensure all required variables are set.\n')
    }
  }
}





