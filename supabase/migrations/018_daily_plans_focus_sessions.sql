-- Daily Plans & Focus Sessions (Phase 0 — data foundations)

-- ============================================
-- DAILY PLANS
-- ============================================

CREATE TABLE IF NOT EXISTS daily_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_date DATE NOT NULL,
    goals JSONB DEFAULT '[]',
    priority_goal_id TEXT,
    blockers TEXT[],
    suggested_duration_minutes INT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'completed', 'reflected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_plan_date UNIQUE(user_id, plan_date)
);

CREATE INDEX idx_daily_plans_user_date ON daily_plans(user_id, plan_date DESC);

-- Row Level Security
ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily plans"
    ON daily_plans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily plans"
    ON daily_plans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily plans"
    ON daily_plans FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily plans"
    ON daily_plans FOR DELETE
    USING (auth.uid() = user_id);


-- ============================================
-- FOCUS SESSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS focus_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    daily_plan_id UUID NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
    goal_id TEXT,
    goal_title TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_target_minutes INT,
    blocked_sites TEXT[],
    focused_seconds INT NOT NULL DEFAULT 0,
    drift_events JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_focus_sessions_user ON focus_sessions(user_id, started_at DESC);
CREATE INDEX idx_focus_sessions_plan ON focus_sessions(daily_plan_id);
CREATE INDEX idx_focus_sessions_active ON focus_sessions(user_id) WHERE status = 'active';

-- Row Level Security
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own focus sessions"
    ON focus_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own focus sessions"
    ON focus_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own focus sessions"
    ON focus_sessions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own focus sessions"
    ON focus_sessions FOR DELETE
    USING (auth.uid() = user_id);


-- ============================================
-- USER SETTINGS — add clarity-specific columns
-- ============================================

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS evening_reflection_time TIME DEFAULT '18:00',
    ADD COLUMN IF NOT EXISTS drift_threshold_minutes INT DEFAULT 12;
