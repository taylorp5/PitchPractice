#!/usr/bin/env tsx
/**
 * Verify environment variables are accessible in Next.js context
 * This simulates how Next.js loads env vars
 */

// Next.js automatically loads .env.local, but we can verify the format
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')

console.log('Checking .env.local file...\n')

try {
  const content = readFileSync(envPath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'))
  
  const vars: Record<string, { present: boolean; hasValue: boolean }> = {}
  
  for (const line of lines) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match) {
      const [, key, value] = match
      vars[key] = {
        present: true,
        hasValue: value.trim().length > 0
      }
    }
  }
  
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY'
  ]
  
  console.log('Environment Variables Status:')
  console.log('─'.repeat(50))
  
  let allGood = true
  for (const varName of required) {
    const status = vars[varName]
    if (!status) {
      console.log(`  ✗ ${varName}: Missing from file`)
      allGood = false
    } else if (!status.hasValue) {
      console.log(`  ⚠ ${varName}: Present but empty`)
      allGood = false
    } else {
      console.log(`  ✓ ${varName}: Present and has value`)
    }
  }
  
  console.log('─'.repeat(50))
  
  if (allGood) {
    console.log('\n✓ All required variables are present in .env.local')
    console.log('\n⚠ IMPORTANT: If you just created/updated .env.local, you MUST restart your dev server:')
    console.log('   1. Stop the current dev server (Ctrl+C)')
    console.log('   2. Run: npm run dev')
    console.log('\nNext.js only loads environment variables when the server starts.\n')
  } else {
    console.log('\n✗ Some variables are missing or empty')
    console.log('Please check your .env.local file and ensure all variables have values.\n')
  }
} catch (error: any) {
  if (error.code === 'ENOENT') {
    console.error('✗ .env.local file not found')
    console.error('Please create it in the project root with your Supabase credentials.\n')
  } else {
    console.error('Error reading .env.local:', error.message)
  }
  process.exit(1)
}


