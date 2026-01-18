-- Migration: Add Aoi widget visibility preferences
-- Date: 2026-01-18

-- Add aoi_hidden_global: hide Aoi on all websites
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS aoi_hidden_global BOOLEAN DEFAULT false;

-- Add aoi_hidden_domains: array of domains where Aoi is hidden
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS aoi_hidden_domains TEXT[] DEFAULT '{}';

-- Comment for documentation
COMMENT ON COLUMN user_settings.aoi_hidden_global IS 'When true, Aoi widget is hidden on all websites';
COMMENT ON COLUMN user_settings.aoi_hidden_domains IS 'Array of domain names where Aoi widget is hidden (e.g., twitter.com, reddit.com)';
