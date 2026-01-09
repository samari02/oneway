-- Add onboarding fields to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS wake_time text,
ADD COLUMN IF NOT EXISTS sleep_time text,
ADD COLUMN IF NOT EXISTS screen_off_time text,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
