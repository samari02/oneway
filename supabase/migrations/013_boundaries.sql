-- Boundaries table: URL blocking rules separate from habits
-- This replaces the boundary-related fields in habits table

CREATE TABLE IF NOT EXISTS boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- What to block
  name TEXT NOT NULL,                           -- Display name (e.g., "Social Media")
  patterns TEXT[] NOT NULL DEFAULT '{}',        -- URL patterns (e.g., ["twitter.com", "*.reddit.com"])
  
  -- When to block
  schedule TEXT NOT NULL DEFAULT 'always',      -- 'always', 'scheduled', 'weekdays', 'weekends'
  time_start TIME,                              -- Only for 'scheduled'
  time_end TIME,                                -- Only for 'scheduled'
  
  -- How to handle
  mode TEXT NOT NULL DEFAULT 'block',           -- 'block' or 'awareness'
  reason TEXT,                                  -- Why this boundary exists
  
  -- State
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for faster user queries
CREATE INDEX IF NOT EXISTS idx_boundaries_user_id ON boundaries(user_id);
CREATE INDEX IF NOT EXISTS idx_boundaries_active ON boundaries(user_id, is_active);

-- RLS policies
ALTER TABLE boundaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own boundaries"
  ON boundaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own boundaries"
  ON boundaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own boundaries"
  ON boundaries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own boundaries"
  ON boundaries FOR DELETE
  USING (auth.uid() = user_id);

-- Boundary violations tracking
CREATE TABLE IF NOT EXISTS boundary_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boundary_id UUID NOT NULL REFERENCES boundaries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  action TEXT NOT NULL,                         -- 'blocked', 'bypassed', 'notified'
  
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for stats queries
CREATE INDEX IF NOT EXISTS idx_violations_boundary ON boundary_violations(boundary_id);
CREATE INDEX IF NOT EXISTS idx_violations_user_time ON boundary_violations(user_id, timestamp DESC);

-- RLS for violations
ALTER TABLE boundary_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own violations"
  ON boundary_violations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own violations"
  ON boundary_violations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_boundaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boundaries_updated_at
  BEFORE UPDATE ON boundaries
  FOR EACH ROW
  EXECUTE FUNCTION update_boundaries_updated_at();
