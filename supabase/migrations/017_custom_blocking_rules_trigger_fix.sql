-- Repair for environments where 016 failed at the trigger step because
-- update_boundaries_updated_at() did not exist. Safe to re-run (idempotent).

CREATE OR REPLACE FUNCTION update_custom_blocking_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS custom_blocking_rules_updated_at ON custom_blocking_rules;

CREATE TRIGGER custom_blocking_rules_updated_at
  BEFORE UPDATE ON custom_blocking_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_blocking_rules_updated_at();
