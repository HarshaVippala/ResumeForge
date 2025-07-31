-- Add Resume Matcher score columns to resumes table
-- Created: 2025-01-10

-- Add new columns for real ATS scores and keyword analysis
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS keyword_match_score decimal(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS matched_keywords text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS missing_keywords text[] DEFAULT '{}';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_resumes_ats_score ON resumes(ats_score);
CREATE INDEX IF NOT EXISTS idx_resumes_keyword_match_score ON resumes(keyword_match_score);

-- Update existing resumes to calculate keyword_match_score from keyword_density
UPDATE resumes 
SET keyword_match_score = 
  CASE 
    WHEN keyword_density IS NOT NULL AND jsonb_typeof(keyword_density) = 'object' 
    THEN LEAST(jsonb_object_keys(keyword_density)::int * 0.1, 1.0)
    ELSE 0
  END
WHERE keyword_match_score = 0;

-- Add comment explaining the columns
COMMENT ON COLUMN resumes.keyword_match_score IS 'Percentage of job keywords matched in resume (0-1)';
COMMENT ON COLUMN resumes.matched_keywords IS 'Array of keywords from job description found in resume';
COMMENT ON COLUMN resumes.missing_keywords IS 'Array of keywords from job description not found in resume';