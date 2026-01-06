-- Create user_entitlements table to store Stripe purchase entitlements
CREATE TABLE IF NOT EXISTS user_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text, -- For non-authenticated users (fallback)
  plan text NOT NULL CHECK (plan IN ('starter', 'coach', 'daypass')),
  stripe_checkout_session_id text,
  stripe_price_id text,
  stripe_customer_id text,
  expires_at timestamptz, -- For daypass (24 hours) or subscription expiration
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Ensure either user_id or session_id is set
  CONSTRAINT user_entitlements_user_or_session CHECK (
    (user_id IS NOT NULL) OR (session_id IS NOT NULL)
  )
);

-- Create unique index on stripe_checkout_session_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_entitlements_stripe_session_unique ON user_entitlements(stripe_checkout_session_id);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_entitlements_user_id ON user_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_session_id ON user_entitlements(session_id);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_plan ON user_entitlements(plan);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_stripe_session ON user_entitlements(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_expires_at ON user_entitlements(expires_at);

-- Enable RLS
ALTER TABLE user_entitlements ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own entitlements
CREATE POLICY "Users can view their own entitlements"
  ON user_entitlements
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all entitlements (for webhooks and sync)
-- Note: This requires service role key, which is only available server-side

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_entitlements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_entitlements_updated_at
  BEFORE UPDATE ON user_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION update_user_entitlements_updated_at();

