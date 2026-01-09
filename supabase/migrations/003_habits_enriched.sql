-- Enrich habits with more details
ALTER TABLE habits 
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS duration_minutes integer,
ADD COLUMN IF NOT EXISTS is_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS time_of_day text DEFAULT 'anytime' CHECK (time_of_day IN ('morning', 'evening', 'anytime'));

-- Add comment for clarity
COMMENT ON COLUMN habits.is_required IS 'If true, this habit must be completed to unblock sites in strict mode';
COMMENT ON COLUMN habits.time_of_day IS 'When this habit should be done: morning, evening, or anytime';
