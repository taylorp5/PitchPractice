import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { logEnvStatus } from '@/lib/env-check'

let supabaseAdminInstance: SupabaseClient | null = null
let envChecked = false

// Lazy initialization to avoid build-time errors
export function getSupabaseAdmin(): SupabaseClient {
  // Check env vars once on first call (dev only)
  if (!envChecked && process.env.NODE_ENV === 'development') {
    logEnvStatus()
    envChecked = true
  }

  if (supabaseAdminInstance) {
    return supabaseAdminInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables')
  }

  supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  return supabaseAdminInstance
}

