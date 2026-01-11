-- Navigation History for Clarity Insights
-- Privacy-first: Only domains stored, no full URLs with query params

-- Create navigation_history table
CREATE TABLE IF NOT EXISTS navigation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Core data (privacy-first)
  domain text NOT NULL,              -- e.g., "twitter.com" (not full URL)
  category text NOT NULL DEFAULT 'other',  -- social_media, news, video, etc.
  is_distraction boolean DEFAULT false,
  
  -- Metadata
  visit_time timestamptz NOT NULL,
  title text,                        -- Sanitized, max 200 chars
  
  -- Sync metadata
  synced_at timestamptz DEFAULT now(),
  source text DEFAULT 'extension',   -- 'extension' or 'import'
  
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_navigation_history_user_time 
  ON navigation_history(user_id, visit_time DESC);

CREATE INDEX IF NOT EXISTS idx_navigation_history_user_domain 
  ON navigation_history(user_id, domain);

CREATE INDEX IF NOT EXISTS idx_navigation_history_user_category 
  ON navigation_history(user_id, category);

-- RLS: Users can only see their own data
ALTER TABLE navigation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own navigation history"
  ON navigation_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own navigation history"
  ON navigation_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own navigation history"
  ON navigation_history FOR DELETE
  USING (auth.uid() = user_id);

-- Aggregated stats table (for faster queries)
CREATE TABLE IF NOT EXISTS navigation_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Period
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  
  -- Stats
  total_visits integer DEFAULT 0,
  visits_by_category jsonb DEFAULT '{}',  -- {"social_media": 150, "news": 50, ...}
  top_domains jsonb DEFAULT '[]',          -- [{"domain": "x.com", "count": 100}, ...]
  top_distractions jsonb DEFAULT '[]',     -- Top distraction domains
  
  -- Metadata
  computed_at timestamptz DEFAULT now(),
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, period_start, period_end)
);

-- RLS for stats
ALTER TABLE navigation_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own navigation stats"
  ON navigation_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own navigation stats"
  ON navigation_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own navigation stats"
  ON navigation_stats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own navigation stats"
  ON navigation_stats FOR DELETE
  USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE navigation_history IS 'Privacy-first browsing history for Clarity insights. Only domains stored, never full URLs.';
COMMENT ON COLUMN navigation_history.domain IS 'Domain only (e.g., twitter.com), no paths or query params';
COMMENT ON COLUMN navigation_history.category IS 'Auto-categorized: social_media, news, video, entertainment, shopping, work, other';
COMMENT ON COLUMN navigation_history.title IS 'Page title, sanitized and truncated to 200 chars';

COMMENT ON TABLE navigation_stats IS 'Pre-computed stats for faster dashboard queries';
