import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please check your .env.local file and ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    )
  }

  // Check for placeholder values
  if (supabaseUrl.includes('your-project-id') || supabaseUrl.includes('your-project.supabase.co')) {
    throw new Error(
      'Supabase URL is set to a placeholder value. Please replace "your-project-id" in .env.local with your actual Supabase project URL from your Supabase dashboard.'
    )
  }

  if (supabaseAnonKey.includes('your-anon-key') || supabaseAnonKey.includes('your-key')) {
    throw new Error(
      'Supabase anon key is set to a placeholder value. Please replace it in .env.local with your actual Supabase anon key from your Supabase dashboard.'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

