-- Enhanced Job Data Migration
-- Adds H1B sponsorship detection and structured technology extraction

-- Add sponsorship detection columns
ALTER TABLE jobs ADD COLUMN sponsorship_status VARCHAR(20) DEFAULT 'UNCERTAIN';
ALTER TABLE jobs ADD COLUMN sponsorship_confidence DECIMAL(3,2) DEFAULT 0.0;
ALTER TABLE jobs ADD COLUMN sponsorship_reasoning TEXT;

-- Add enhanced technology data
ALTER TABLE jobs ADD COLUMN enhanced_tech_stack JSONB;
ALTER TABLE jobs ADD COLUMN processing_status VARCHAR(20) DEFAULT 'new';
ALTER TABLE jobs ADD COLUMN last_processed_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN processing_error TEXT;

-- Add constraints for sponsorship status
ALTER TABLE jobs ADD CONSTRAINT valid_sponsorship_status 
    CHECK (sponsorship_status IN ('SPONSORS_H1B', 'NO_SPONSORSHIP', 'UNCERTAIN'));

-- Add constraints for processing status  
ALTER TABLE jobs ADD CONSTRAINT valid_processing_status
    CHECK (processing_status IN ('new', 'processing', 'completed', 'failed'));

-- Add constraints for confidence score
ALTER TABLE jobs ADD CONSTRAINT valid_sponsorship_confidence
    CHECK (sponsorship_confidence >= 0.0 AND sponsorship_confidence <= 1.0);

-- Add indexes for performance
CREATE INDEX idx_jobs_sponsorship_status ON jobs(sponsorship_status);
CREATE INDEX idx_jobs_processing_status ON jobs(processing_status);
CREATE INDEX idx_jobs_last_processed ON jobs(last_processed_at);

-- Add index for enhanced tech stack JSON queries
CREATE INDEX idx_jobs_enhanced_tech_stack ON jobs USING GIN(enhanced_tech_stack);

-- Update search vector function to include sponsorship data
CREATE OR REPLACE FUNCTION update_jobs_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.company, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.skills, ' '), '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.sponsorship_status, '')), 'B');
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql

-- Add comments for documentation
COMMENT ON COLUMN jobs.sponsorship_status IS 'H1B sponsorship status: SPONSORS_H1B, NO_SPONSORSHIP, or UNCERTAIN';
COMMENT ON COLUMN jobs.sponsorship_confidence IS 'Confidence score for sponsorship classification (0.0-1.0)';
COMMENT ON COLUMN jobs.sponsorship_reasoning IS 'LLM reasoning for sponsorship classification';
COMMENT ON COLUMN jobs.enhanced_tech_stack IS 'Structured technology data with categories and requirements';
COMMENT ON COLUMN jobs.processing_status IS 'Status of LLM processing: new, processing, completed, failed';
COMMENT ON COLUMN jobs.last_processed_at IS 'Timestamp of last LLM processing attempt';
COMMENT ON COLUMN jobs.processing_error IS 'Error message if LLM processing failed';

-- Example of enhanced_tech_stack structure:
/*
{
  "technologies": [
    {
      "name": "Python",
      "category": "LANGUAGE", 
      "level": "REQUIRED",
      "experience_years": "3+"
    },
    {
      "name": "Django",
      "category": "FRAMEWORK_LIBRARY",
      "level": "REQUIRED", 
      "experience_years": "2+"
    },
    {
      "name": "AWS",
      "category": "CLOUD_PLATFORM",
      "level": "PREFERRED",
      "experience_years": "1+"
    }
  ],
  "summary": {
    "required_count": 5,
    "preferred_count": 3,
    "primary_language": "Python",
    "primary_framework": "Django"
  }
}
*/