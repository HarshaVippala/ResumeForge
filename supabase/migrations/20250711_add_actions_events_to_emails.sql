ALTER TABLE emails ADD COLUMN action_items jsonb DEFAULT '[]'::jsonb;
ALTER TABLE emails ADD COLUMN extracted_events jsonb DEFAULT '[]'::jsonb; 