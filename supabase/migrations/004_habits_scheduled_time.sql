-- Add scheduled_time to habits for timeline view
ALTER TABLE habits 
ADD COLUMN IF NOT EXISTS scheduled_time text;

-- Example: '05:30', '14:00', etc. (HH:MM format)
-- NULL means "anytime" / no specific time
