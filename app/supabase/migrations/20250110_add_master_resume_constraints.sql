-- =============================================================================
-- Master Resume Management Constraints
-- Date: 2025-01-10
-- Description: Adds constraints and indexes for master resume management
-- =============================================================================

-- Add is_default column to resumes table to track the default master resume
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Create a partial unique index to ensure only one default master resume per user
-- Since this is a personal app, we'll ensure only one default across all master resumes
CREATE UNIQUE INDEX IF NOT EXISTS idx_resumes_one_default_master 
ON resumes (is_default) 
WHERE is_master = true AND is_default = true;

-- Add index for faster master resume queries
CREATE INDEX IF NOT EXISTS idx_resumes_master_active 
ON resumes (is_master, is_active) 
WHERE is_master = true AND is_active = true;

-- Create a function to ensure at least one master resume is default
CREATE OR REPLACE FUNCTION ensure_default_master_resume()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is the first master resume, make it default
    IF NEW.is_master = true AND NOT EXISTS (
        SELECT 1 FROM resumes 
        WHERE is_master = true AND is_default = true AND id != NEW.id
    ) THEN
        NEW.is_default := true;
    END IF;
    
    -- If setting a new default, unset others
    IF NEW.is_master = true AND NEW.is_default = true THEN
        UPDATE resumes 
        SET is_default = false 
        WHERE is_master = true AND is_default = true AND id != NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new master resumes
DROP TRIGGER IF EXISTS ensure_default_master_resume_trigger ON resumes;
CREATE TRIGGER ensure_default_master_resume_trigger
BEFORE INSERT OR UPDATE ON resumes
FOR EACH ROW
EXECUTE FUNCTION ensure_default_master_resume();

-- Update existing resumes: if there are any master resumes without a default, set the first one
UPDATE resumes 
SET is_default = true 
WHERE id = (
    SELECT id 
    FROM resumes 
    WHERE is_master = true AND is_active = true 
    ORDER BY created_at ASC 
    LIMIT 1
) 
AND NOT EXISTS (
    SELECT 1 
    FROM resumes 
    WHERE is_master = true AND is_default = true
);

-- Add RLS policies for master resume management
-- Users can only manage their own master resumes (in a multi-user setup)
-- Since this is a personal app, we'll allow all operations for now
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Enable all operations on resumes" ON resumes;

-- Create a permissive policy for personal use
CREATE POLICY "Enable all operations on resumes" ON resumes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Add helpful comments
COMMENT ON COLUMN resumes.is_master IS 'Indicates if this resume is a master template';
COMMENT ON COLUMN resumes.is_default IS 'Indicates if this master resume is the default one';

-- =============================================================================
-- Migration Complete
-- =============================================================================