-- Bucket → sub-category hierarchy for focus areas
-- parent_id IS NULL = bucket (top level)
-- parent_id SET     = sub-category (child)

ALTER TABLE focus_areas ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES focus_areas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_focus_areas_parent ON focus_areas(user_id, parent_id);

-- Migrate existing flat focus areas: reparent under a "General" bucket per user
DO $$
DECLARE
  r RECORD;
  general_id UUID;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id
    FROM focus_areas
    WHERE parent_id IS NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM focus_areas
      WHERE user_id = r.user_id AND parent_id IS NOT NULL
    ) THEN
      INSERT INTO focus_areas (user_id, label, emoji, color, source, status, display_order)
      VALUES (r.user_id, 'General', '📁', '#64748b', 'user', 'active', -1)
      RETURNING id INTO general_id;

      UPDATE focus_areas
      SET parent_id = general_id
      WHERE user_id = r.user_id
        AND id != general_id
        AND parent_id IS NULL;
    END IF;
  END LOOP;
END $$;
