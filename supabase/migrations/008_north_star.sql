-- North Star Goal feature
-- A main goal that gives meaning to daily habits

-- Add north star fields to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS north_star_goal text,
ADD COLUMN IF NOT EXISTS north_star_icon text DEFAULT '🎯',
ADD COLUMN IF NOT EXISTS north_star_created_at timestamptz;

-- Link habits to the north star goal
ALTER TABLE habits
ADD COLUMN IF NOT EXISTS linked_to_north_star boolean DEFAULT false;

-- Comments
COMMENT ON COLUMN user_settings.north_star_goal IS 'The user main goal/objective (e.g., "Be healthier for my wedding")';
COMMENT ON COLUMN user_settings.north_star_icon IS 'Emoji icon for the north star goal';
COMMENT ON COLUMN habits.linked_to_north_star IS 'Whether this habit contributes to the north star goal';
