-- Add display_name to user_settings for personalized greetings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS display_name text;
