# Deployment Guide

## Deploying to Vercel

### Prerequisites
1. GitHub account
2. Vercel account (free tier works)
3. Supabase project with migrations run
4. OpenAI API key

### Steps

1. **Push to GitHub**
   ```bash
   # Create a new repository on GitHub, then:
   git remote add origin https://github.com/YOUR_USERNAME/PitchPractice.git
   git branch -M main
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings

3. **Configure Environment Variables**
   In Vercel project settings, add these environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (keep secret!)
   - `OPENAI_API_KEY` - Your OpenAI API key (keep secret!)

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `your-project.vercel.app`

### Post-Deployment

1. **Run Database Migrations**
   - Go to your Supabase SQL Editor
   - Run `supabase/migrations/001_initial_schema.sql`
   - Run `supabase/migrations/002_add_timing_fields.sql`
   - Run `supabase/migrations/002_add_duration_ms.sql`

2. **Create Storage Bucket**
   - In Supabase dashboard → Storage
   - Create bucket: `pitchpractice-audio`
   - Set to **Private**

3. **Test the App**
   - Visit your Vercel URL
   - Record or upload a test pitch
   - Verify transcription and analysis work

### Troubleshooting

- **Build fails**: Check that all environment variables are set
- **API errors**: Verify Supabase credentials and OpenAI API key
- **Storage errors**: Ensure bucket exists and is named `pitchpractice-audio`




