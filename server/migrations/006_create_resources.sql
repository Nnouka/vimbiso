-- resources: sourced Kenyan directory (DIR-1, Sprint 2). Table created now
-- per INF-2's "every table exists up front" requirement.
CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  country TEXT,
  region TEXT,
  category TEXT,
  name TEXT,
  phone TEXT,
  address TEXT,
  hours TEXT,
  source_name TEXT,
  source_url TEXT,
  last_verified_date DATE,
  language_support TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_resources_category_region
  ON resources (category, region);
