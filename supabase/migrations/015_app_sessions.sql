-- App Usage Sessions (granular tracking)
-- Each row = one app usage session (start → end)

CREATE TABLE IF NOT EXISTS app_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- App identification
    bundle_id TEXT NOT NULL,           -- e.g., "com.google.Chrome"
    app_name TEXT NOT NULL,            -- e.g., "Google Chrome"
    platform TEXT NOT NULL DEFAULT 'macos',  -- macos, windows, android
    
    -- Timing
    start_time TIMESTAMPTZ NOT NULL,   -- When app became active
    end_time TIMESTAMPTZ,              -- When app lost focus (null if still active)
    duration_ms BIGINT,                -- Computed duration in milliseconds
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicates from re-syncs
    CONSTRAINT unique_session UNIQUE(user_id, bundle_id, start_time)
);

-- Indexes for common queries
CREATE INDEX idx_app_sessions_user_time ON app_sessions(user_id, start_time DESC);
CREATE INDEX idx_app_sessions_user_bundle ON app_sessions(user_id, bundle_id);
-- Note: date-based queries use the start_time index with range conditions

-- Row Level Security
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
    ON app_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
    ON app_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
    ON app_sessions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
    ON app_sessions FOR DELETE
    USING (auth.uid() = user_id);


-- Blocked Apps Configuration
-- Stores which apps are blocked per user

CREATE TABLE IF NOT EXISTS blocked_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Config
    bundle_id TEXT NOT NULL,           -- App to block
    app_name TEXT,                     -- Display name
    platform TEXT NOT NULL DEFAULT 'macos',
    
    -- Scheduling
    blocking_enabled BOOLEAN DEFAULT true,
    schedule TEXT DEFAULT 'always',    -- 'always' | 'scheduled' | 'focus_mode'
    time_start TIME,                   -- Start time for scheduled blocking
    time_end TIME,                     -- End time for scheduled blocking
    days_of_week INTEGER[],            -- 0=Sun, 1=Mon, etc. (null = every day)
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_blocked_app UNIQUE(user_id, bundle_id, platform)
);

-- Index for queries
CREATE INDEX idx_blocked_apps_user ON blocked_apps(user_id);

-- Row Level Security
ALTER TABLE blocked_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own blocked apps"
    ON blocked_apps FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- Optional: Pre-aggregated stats for fast dashboard queries
-- Updated by a scheduled job or trigger

CREATE TABLE IF NOT EXISTS app_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Period
    period TEXT NOT NULL,              -- 'daily' | 'weekly' | 'monthly'
    period_start DATE NOT NULL,        -- Start of period
    platform TEXT NOT NULL DEFAULT 'macos',
    
    -- Aggregated data (JSONB for flexibility)
    stats JSONB NOT NULL DEFAULT '{}',
    -- Example: {"com.google.Chrome": {"total_ms": 3600000, "sessions": 5}}
    
    -- Metadata
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_stats_period UNIQUE(user_id, period, period_start, platform)
);

CREATE INDEX idx_app_usage_stats_user ON app_usage_stats(user_id, period, period_start DESC);

ALTER TABLE app_usage_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own stats"
    ON app_usage_stats FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
