-- Focus Areas & User Context (Phase 0 — emergent category system)

-- ============================================
-- FOCUS AREAS
-- ============================================

CREATE TABLE IF NOT EXISTS public.focus_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    emoji TEXT,
    color TEXT,
    source TEXT NOT NULL DEFAULT 'user'
        CHECK (source IN ('user', 'ai_proposed', 'ai_confirmed')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'archived')),
    confidence FLOAT DEFAULT 1.0,
    mention_count INT DEFAULT 0,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_focus_areas_user_id ON public.focus_areas(user_id);
CREATE INDEX idx_focus_areas_user_status ON public.focus_areas(user_id, status);

ALTER TABLE public.focus_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own focus areas"
    ON public.focus_areas FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ============================================
-- USER CONTEXT (seeds focus area engine)
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    context_text TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_context_user_id ON public.user_context(user_id);

ALTER TABLE public.user_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own context"
    ON public.user_context FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
