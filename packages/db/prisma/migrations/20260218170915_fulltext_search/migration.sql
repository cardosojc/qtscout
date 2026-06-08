-- Full-text search setup for meetings table
-- This migration adds a tsvector column for full-text search, a GIN index, and a trigger to keep it updated

-- Step 1: Add the tsvector column (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'contenttsvector') THEN
        ALTER TABLE meetings ADD COLUMN "contentTsvector" tsvector;
    END IF;
END $$;

-- Step 2: Create a function to generate the tsvector content
CREATE OR REPLACE FUNCTION meetings_search_trigger()
RETURNS trigger AS $$
BEGIN
    NEW."contentTsvector" :=
        setweight(to_tsvector('portuguese', COALESCE(NEW.content, '')), 'A') ||
        setweight(to_tsvector('portuguese', COALESCE(NEW.identifier, '')), 'B') ||
        setweight(to_tsvector('portuguese', COALESCE(NEW.location, '')), 'C') ||
        setweight(to_tsvector('portuguese', COALESCE(NEW.agenda::text, '')), 'D') ||
        setweight(to_tsvector('portuguese', COALESCE(NEW."actionItems"::text, '')), 'D');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Step 3: Create or replace the trigger
DROP TRIGGER IF EXISTS meetings_search_trigger ON meetings;
CREATE TRIGGER meetings_search_trigger
    BEFORE INSERT OR UPDATE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION meetings_search_trigger();

-- Step 4: Create GIN index for fast full-text search (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'meetings' AND indexname = 'meetings_content_tsvector_idx'
    ) THEN
        CREATE INDEX meetings_content_tsvector_idx ON meetings USING gin ("contentTsvector");
    END IF;
END $$;

-- Step 5: Update existing rows to populate the tsvector column
UPDATE meetings SET content = content WHERE "contentTsvector" IS NULL;
