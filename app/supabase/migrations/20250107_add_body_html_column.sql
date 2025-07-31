-- Add missing body_html column to email_communications table
ALTER TABLE public.email_communications 
ADD COLUMN IF NOT EXISTS body_html TEXT;

-- Update the search vector function to include body_html
CREATE OR REPLACE FUNCTION update_email_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('email_search',
    COALESCE(NEW.subject, '') || ' ' ||
    COALESCE(NEW.sender_name, '') || ' ' ||
    COALESCE(NEW.extracted_company, '') || ' ' ||
    COALESCE(NEW.extracted_position, '') || ' ' ||
    COALESCE(NEW.ai_summary, '') || ' ' ||
    COALESCE(NEW.body_text, '') || ' ' ||
    COALESCE(NEW.body_html, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;