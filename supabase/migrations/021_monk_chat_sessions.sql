-- Monk chat sessions (Clarity Home — one persisted conversation per user)

CREATE TABLE IF NOT EXISTS public.monk_chat_sessions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    phase TEXT NOT NULL DEFAULT 'welcome',
    collected_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    proposal JSONB NOT NULL DEFAULT '{}'::jsonb,
    saved_summary JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_monk_chat_sessions_user_id ON public.monk_chat_sessions(user_id);

ALTER TABLE public.monk_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own monk chat sessions"
    ON public.monk_chat_sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
