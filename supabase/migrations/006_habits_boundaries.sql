-- Add boundary support to habits (unified Do/Avoid system)

-- Habit type: 'do' (action to take) or 'avoid' (behavior to avoid)
ALTER TABLE habits 
ADD COLUMN IF NOT EXISTS habit_type text DEFAULT 'do' CHECK (habit_type IN ('do', 'avoid'));

-- For 'avoid' type boundaries
ALTER TABLE habits 
ADD COLUMN IF NOT EXISTS avoid_category text CHECK (avoid_category IN ('digital', 'physical')),
ADD COLUMN IF NOT EXISTS time_start text,  -- HH:MM format, start of boundary period
ADD COLUMN IF NOT EXISTS time_end text,    -- HH:MM format, end of boundary period
ADD COLUMN IF NOT EXISTS blocked_sites text[];  -- For digital boundaries

-- Days of week this habit/boundary applies (1=Mon, 7=Sun)
-- NULL means every day
ALTER TABLE habits 
ADD COLUMN IF NOT EXISTS days_of_week integer[];

-- Comments for clarity
COMMENT ON COLUMN habits.habit_type IS 'Type of habit: do (action to take) or avoid (behavior to avoid/boundary)';
COMMENT ON COLUMN habits.avoid_category IS 'For avoid type: digital (sites/apps) or physical (food, etc.)';
COMMENT ON COLUMN habits.time_start IS 'Start time for boundary period (HH:MM)';
COMMENT ON COLUMN habits.time_end IS 'End time for boundary period (HH:MM)';
COMMENT ON COLUMN habits.blocked_sites IS 'Array of site patterns to block (for digital boundaries)';
COMMENT ON COLUMN habits.days_of_week IS 'Days this applies: 1=Mon, 2=Tue, ..., 7=Sun. NULL = every day';
