#!/usr/bin/env tsx
/**
 * Standalone script to check environment variables
 * Run with: npx tsx scripts/check-env.ts
 * 
 * Note: This script is excluded from Next.js build
 */

// Simple env check without external dependencies
const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
]

console.log('\n[Env Check] Environment Variables Status:')
console.log('─'.repeat(50))

let allPresent = true
for (const varName of REQUIRED_ENV_VARS) {
  const isPresent = !!process.env[varName]
  const icon = isPresent ? '✓' : '✗'
  const label = isPresent ? 'Set' : 'Missing'
  console.log(`  ${icon} ${varName}: ${label}`)
  if (!isPresent) {
    allPresent = false
  }
}

console.log('─'.repeat(50))

if (allPresent) {
  console.log('✓ All required environment variables are present\n')
} else {
  console.error('✗ Some environment variables are missing\n')
  console.error('Please check your .env.local file and ensure all required variables are set.\n')
}

process.exit(allPresent ? 0 : 1)

