-- Per-user URL / search keyword blocking rules (Clarity extension sync)
-- Distinct from legacy `blocking_rules` (001) and habit-style `boundaries` (013)

CREATE TABLE IF NOT EXISTS custom_blocking_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  rule_type TEXT NOT NULL CHECK (rule_type IN ('url_contains', 'search_contains')),
  value TEXT NOT NULL,
  match_mode TEXT NOT NULL DEFAULT 'contains' CHECK (match_mode IN ('contains', 'host_is')),
  note TEXT,

  commitment_level TEXT NOT NULL DEFAULT 'flexible'
    CHECK (commitment_level IN ('flexible', 'committed', 'locked')),
  locked_until TIMESTAMPTZ,

  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_blocking_rules_user
  ON custom_blocking_rules(user_id);

CREATE INDEX IF NOT EXISTS idx_custom_blocking_rules_user_type
  ON custom_blocking_rules(user_id, rule_type);

ALTER TABLE custom_blocking_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom blocking rules"
  ON custom_blocking_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own custom blocking rules"
  ON custom_blocking_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom blocking rules"
  ON custom_blocking_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom blocking rules"
  ON custom_blocking_rules FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER custom_blocking_rules_updated_at
  BEFORE UPDATE ON custom_blocking_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_boundaries_updated_at();
