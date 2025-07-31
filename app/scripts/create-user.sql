-- Create user profile bypassing RLS
-- Run this in Supabase SQL editor

-- First, check if user exists
SELECT * FROM user_profile WHERE id = 'f556989c-4903-47d6-8700-0afe3d4189e5';

-- If not exists, insert user
INSERT INTO user_profile (id, email, name, default_resume_data, preferences)
VALUES (
  'f556989c-4903-47d6-8700-0afe3d4189e5',
  'harsha.vippala1@gmail.com',
  'Harsha Vippala',
  '{
    "contact": {
      "email": "harsha.vippala1@gmail.com",
      "name": "Harsha Vippala"
    }
  }'::jsonb,
  '{
    "theme": "light",
    "emailSyncEnabled": true,
    "notificationSettings": {
      "email": true,
      "browser": true,
      "applicationDeadlines": true,
      "interviewReminders": true
    }
  }'::jsonb
) ON CONFLICT (id) DO UPDATE 
SET 
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  updated_at = NOW();

-- Verify user was created
SELECT * FROM user_profile WHERE id = 'f556989c-4903-47d6-8700-0afe3d4189e5';