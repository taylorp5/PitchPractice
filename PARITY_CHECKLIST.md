# Local-Vercel Build Parity Checklist

## ✅ Changes Made

### 1. Node Version Specification
- **Added `.nvmrc`** with Node 20
- **Added `engines` to `package.json`** to specify Node >=20.0.0
- **Files changed:**
  - `.nvmrc` (new)
  - `package.json`

### 2. Environment Variable Management
- **Created `lib/env-check.ts`** - Server-only helper that logs boolean status of env vars
- **Updated `middleware.ts`** - Handles missing env vars differently in dev vs production
- **Updated `lib/supabase/server.ts`** - Logs env status on first call in dev mode
- **Created `scripts/check-env.ts`** - Standalone script to check env vars
- **Files changed:**
  - `lib/env-check.ts` (new)
  - `middleware.ts`
  - `lib/supabase/server.ts`
  - `scripts/check-env.ts` (new)

### 3. Production Build Scripts
- **Added `build:prod` script** - Explicitly sets NODE_ENV=production
- **Added `start:prod` script** - Explicitly sets NODE_ENV=production
- **Files changed:**
  - `package.json`

### 4. Build Configuration
- **Updated `next.config.js`** - Disabled production source maps for consistency
- **Files changed:**
  - `next.config.js`

### 5. CSS/Tailwind Fixes
- **Fixed `app/layout.tsx`** - Removed conflicting `bg-gray-50` class (globals.css handles background)
- **Updated `tailwind.config.ts`** - Added `lib/**/*` to content paths for complete coverage
- **Files changed:**
  - `app/layout.tsx`
  - `tailwind.config.ts`

### 6. TypeScript Configuration
- **Updated `tsconfig.json`** - Excluded standalone scripts from build
- **Files changed:**
  - `tsconfig.json`

## 🚀 How to Run Local Production Preview

### Prerequisites
1. Ensure you're using Node 20:
   ```bash
   # If using nvm
   nvm use
   
   # Or check version
   node --version  # Should be 20.x.x
   ```

2. Ensure all environment variables are set in `.env.local`:
   ```bash
   # Check env vars (optional)
   npx tsx scripts/check-env.ts
   ```

### Build and Start Production Server

```bash
# Build for production
npm run build

# Start production server
npm run start
```

Or use the explicit production scripts:
```bash
npm run build:prod
npm run start:prod
```

The app will be available at `http://localhost:3000`

### Verify Parity

1. **Compare build output:**
   - Check that route sizes match between local and Vercel
   - Verify middleware size is consistent (~73 kB)

2. **Visual comparison:**
   - Open local production build: `http://localhost:3000`
   - Compare with Vercel production: `https://your-app.vercel.app`
   - Check:
     - Background colors match (should be `#0B0F14` from globals.css)
     - Navbar renders identically
     - No duplicate layouts or components
     - Tailwind classes apply correctly
     - No dev-only UI elements

3. **Check console:**
   - No environment variable warnings in production
   - No dev-only error messages
   - No source map references

## 🔍 Environment Variable Status

The env check helper logs boolean status (present/missing) for:
- `NEXT_PUBLIC_SUPABASE_URL` (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
- `SUPABASE_SERVICE_ROLE_KEY` (private - only presence logged)
- `OPENAI_API_KEY` (private - only presence logged)

**Note:** The helper only logs in development mode. In production, it's silent.

## 📋 Parity Verification Checklist

- [ ] Node version matches (20.x.x)
- [ ] Build completes without errors
- [ ] Route sizes match Vercel build output
- [ ] Middleware size matches (~73 kB)
- [ ] Background colors match (dark theme: `#0B0F14`)
- [ ] Navbar renders identically
- [ ] No duplicate layouts
- [ ] Tailwind classes apply correctly
- [ ] No dev-only UI elements visible
- [ ] Environment variables load correctly
- [ ] No console errors in production mode

## 🐛 Common Issues & Fixes

### Issue: Different background colors
**Fix:** Removed conflicting `bg-gray-50` from `app/layout.tsx`. Background is now controlled by `globals.css` only.

### Issue: Tailwind classes not applying
**Fix:** Updated `tailwind.config.ts` to include `lib/**/*` in content paths.

### Issue: Environment variables not loading
**Fix:** Use `.env.local` for local development. Vercel uses environment variables set in dashboard.

### Issue: Build fails with TypeScript errors
**Fix:** Ensure `scripts/check-env.ts` is excluded from build (already done in `tsconfig.json`).

## 📝 Notes

- **Runtime:** Next.js 14.2.35 (matches Vercel default)
- **Node:** 20.x (specified in `.nvmrc` and `package.json`)
- **Build command:** `next build` (same as Vercel)
- **Start command:** `next start` (same as Vercel)
- **Source maps:** Disabled in production for consistency

## 🔄 Next Steps

1. Run local production build: `npm run build && npm run start`
2. Compare visually with Vercel production
3. If differences persist, check:
   - Vercel environment variables match local `.env.local`
   - Vercel Node version (should be 20.x)
   - Vercel build settings (should match `next.config.js`)

