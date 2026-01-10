-- Add boundary tracking fields to habit_check_ins

-- For boundaries: track violations and bypass timestamps
ALTER TABLE habit_check_ins 
ADD COLUMN IF NOT EXISTS violation_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS bypass_timestamps timestamptz[];

-- Add completed boolean for boundaries (true = respected, false = violated)
-- For regular 'do' habits, presence in table means completed
-- For 'avoid' boundaries, we need explicit status
ALTER TABLE habit_check_ins 
ADD COLUMN IF NOT EXISTS completed boolean DEFAULT true;

-- Comments
COMMENT ON COLUMN habit_check_ins.violation_count IS 'Number of times boundary was violated (for digital boundaries)';
COMMENT ON COLUMN habit_check_ins.bypass_timestamps IS 'Timestamps of each bypass (for tracking patterns)';
COMMENT ON COLUMN habit_check_ins.completed IS 'For boundaries: true = respected, false = violated. For habits: always true when checked';
