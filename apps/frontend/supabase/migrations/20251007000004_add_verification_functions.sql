-- ============================================
-- DATABASE VERIFICATION FUNCTIONS (UTILITY)
-- ============================================
-- Provides helper functions for inspecting schema and data counts
-- These are useful for migrations/tests but not used by application code

-- 1. List all public tables
CREATE OR REPLACE FUNCTION verify_tables()
RETURNS TABLE (table_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::TEXT
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
  ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql;

-- 2. List all foreign key relationships
CREATE OR REPLACE FUNCTION verify_foreign_keys()
RETURNS TABLE (
  table_name TEXT,
  column_name TEXT,
  references_table TEXT,
  references_column TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.table_name::TEXT,
    kcu.column_name::TEXT,
    ccu.table_name::TEXT,
    ccu.column_name::TEXT
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
  ORDER BY tc.table_name, kcu.column_name;
END;
$$ LANGUAGE plpgsql;

-- 3. Count records in each public table
CREATE OR REPLACE FUNCTION verify_data_counts()
RETURNS TABLE (table_name TEXT, record_count BIGINT) AS $$
DECLARE
  table_record RECORD;
  query_text TEXT;
BEGIN
  FOR table_record IN
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  LOOP
    query_text := 'SELECT COUNT(*) FROM ' || quote_ident(table_record.table_name);
    EXECUTE query_text INTO record_count;
    table_name := table_record.table_name;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
