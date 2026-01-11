-- Allow multiple conversations per user (remove unique constraint)
-- Add title and mode for better organization

-- Drop the unique constraint on user_id to allow multiple conversations
ALTER TABLE ai_conversations DROP CONSTRAINT IF EXISTS ai_conversations_user_id_key;

-- Add title column for conversation identification
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS title text;

-- Add mode column (north_star, goals, habits, progress, etc.)
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS mode text;

-- Add is_active to mark the current conversation (optional, for "continue" feature)
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;

-- Index for fast lookup by user_id + created_at
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_created 
  ON ai_conversations(user_id, created_at DESC);

-- Comment
COMMENT ON COLUMN ai_conversations.title IS 'Auto-generated title from first user message or mode';
COMMENT ON COLUMN ai_conversations.mode IS 'Conversation mode: north_star, goals, habits, progress, tasks';
COMMENT ON COLUMN ai_conversations.is_active IS 'Whether this is the active/current conversation';
