-- =============================================================================
-- KB-First v2.9 Database Schema
-- =============================================================================
-- 
-- Run this against your PostgreSQL database to set up the KB schema.
-- Works with both ruvector-postgres and standard pgvector.
--
-- Usage:
--   psql $DATABASE_URL -f schema.sql
--
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- Text similarity

-- Try ruvector first (enhanced features), fall back to pgvector
DO $$ 
BEGIN
  CREATE EXTENSION IF NOT EXISTS ruvector;
  RAISE NOTICE 'Using ruvector extension (enhanced features available)';
EXCEPTION WHEN OTHERS THEN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
    RAISE NOTICE 'Using pgvector extension (standard features)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No vector extension available - text search only';
  END;
END $$;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Knowledge Base Nodes
-- Each row is a piece of curated knowledge with expert attribution
CREATE TABLE IF NOT EXISTS kb_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Organization
  namespace TEXT NOT NULL DEFAULT 'default',  -- Separate KBs per client/project
  path TEXT NOT NULL,                          -- Hierarchical path: "retirement/withdrawal/4-percent-rule"
  
  -- Content
  title TEXT NOT NULL,
  content TEXT,                                -- The actual knowledge content
  
  -- Attribution (REQUIRED - this is KB-First, not just RAG)
  source_expert TEXT NOT NULL,                 -- "Wade Pfau, PhD" - who said this?
  source_url TEXT NOT NULL,                    -- Link to original source
  
  -- Quality
  confidence REAL DEFAULT 1.0 
    CHECK (confidence >= 0 AND confidence <= 1),  -- 0.0 to 1.0
  
  -- Metadata
  metadata JSONB DEFAULT '{}',                 -- Flexible additional data
  
  -- Vector embedding (384 dims for all-MiniLM-L6-v2)
  embedding vector(384),
  
  -- Usage tracking
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(namespace, path)
);

COMMENT ON TABLE kb_nodes IS 'Core knowledge base content with expert attribution';
COMMENT ON COLUMN kb_nodes.source_expert IS 'Required: Name of expert source (e.g., "Wade Pfau, PhD")';
COMMENT ON COLUMN kb_nodes.source_url IS 'Required: URL to original source material';
COMMENT ON COLUMN kb_nodes.confidence IS 'Quality score 0.0-1.0 (high=0.8+, medium=0.5-0.8, low=<0.5)';

-- =============================================================================
-- GAP DETECTION
-- =============================================================================

-- Track queries that couldn't be answered from the KB
-- Use this to identify what content to add
CREATE TABLE IF NOT EXISTS kb_gaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  query TEXT NOT NULL,                         -- The unanswered query
  reason TEXT,                                 -- Why it couldn't be answered
  namespace TEXT DEFAULT 'default',
  
  -- Tracking
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,          -- How many times this gap appeared
  
  -- Resolution
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by_node UUID REFERENCES kb_nodes(id),
  
  UNIQUE(query, namespace)
);

COMMENT ON TABLE kb_gaps IS 'Queries that could not be answered - use for KB improvement';

-- =============================================================================
-- REASONING BANK (Learning)
-- =============================================================================

-- Store successful query-response patterns for future reference
CREATE TABLE IF NOT EXISTS reasoning_bank (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Pattern
  query_pattern TEXT UNIQUE NOT NULL,          -- The query that worked
  successful_response TEXT NOT NULL,           -- The response that was good
  kb_nodes_used UUID[] DEFAULT '{}',           -- Which nodes contributed
  
  -- Quality
  feedback_score REAL DEFAULT 0.5 
    CHECK (feedback_score >= 0 AND feedback_score <= 1),
  use_count INTEGER DEFAULT 1,                 -- Times this pattern was used
  
  -- Vector for similarity matching
  embedding vector(384),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE reasoning_bank IS 'Successful patterns for learning - improves over time';

-- =============================================================================
-- ANALYTICS
-- =============================================================================

-- Track all KB queries for analysis
CREATE TABLE IF NOT EXISTS kb_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  event_type TEXT NOT NULL,                    -- 'search', 'gap', 'feedback'
  query TEXT,
  namespace TEXT DEFAULT 'default',
  
  -- Results
  results_count INTEGER DEFAULT 0,
  top_confidence REAL,
  gap_detected BOOLEAN DEFAULT false,
  
  -- Performance
  latency_ms INTEGER,
  
  -- Session
  session_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE kb_analytics IS 'Query analytics for monitoring and improvement';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Primary lookups
CREATE INDEX IF NOT EXISTS kb_nodes_namespace_idx ON kb_nodes(namespace);
CREATE INDEX IF NOT EXISTS kb_nodes_path_idx ON kb_nodes(path);
CREATE INDEX IF NOT EXISTS kb_nodes_confidence_idx ON kb_nodes(confidence DESC);

-- Text search
CREATE INDEX IF NOT EXISTS kb_nodes_title_trgm_idx ON kb_nodes USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS kb_nodes_content_trgm_idx ON kb_nodes USING gin(content gin_trgm_ops);

-- Full text search
CREATE INDEX IF NOT EXISTS kb_nodes_fts_idx ON kb_nodes USING gin(
  to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, ''))
);

-- Vector search (HNSW for fast approximate search)
-- This will fail gracefully if vector extension not available
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS kb_nodes_embedding_idx ON kb_nodes 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Vector index not created - extension not available';
END $$;

-- Gap tracking
CREATE INDEX IF NOT EXISTS kb_gaps_namespace_idx ON kb_gaps(namespace);
CREATE INDEX IF NOT EXISTS kb_gaps_count_idx ON kb_gaps(occurrence_count DESC);
CREATE INDEX IF NOT EXISTS kb_gaps_unresolved_idx ON kb_gaps(namespace) WHERE NOT resolved;

-- Analytics
CREATE INDEX IF NOT EXISTS kb_analytics_type_idx ON kb_analytics(event_type);
CREATE INDEX IF NOT EXISTS kb_analytics_time_idx ON kb_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS kb_analytics_session_idx ON kb_analytics(session_id);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
DROP TRIGGER IF EXISTS kb_nodes_updated_at ON kb_nodes;
CREATE TRIGGER kb_nodes_updated_at
  BEFORE UPDATE ON kb_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS reasoning_bank_updated_at ON reasoning_bank;
CREATE TRIGGER reasoning_bank_updated_at
  BEFORE UPDATE ON reasoning_bank
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- HELPFUL VIEWS
-- =============================================================================

-- Top gaps to address
CREATE OR REPLACE VIEW kb_top_gaps AS
SELECT 
  query,
  reason,
  namespace,
  occurrence_count,
  last_seen,
  first_seen
FROM kb_gaps
WHERE NOT resolved
ORDER BY occurrence_count DESC, last_seen DESC
LIMIT 100;

COMMENT ON VIEW kb_top_gaps IS 'Top unresolved gaps - prioritize these for KB improvement';

-- KB health summary
CREATE OR REPLACE VIEW kb_health AS
SELECT
  namespace,
  COUNT(*) as node_count,
  COUNT(*) FILTER (WHERE content IS NOT NULL) as nodes_with_content,
  AVG(confidence) as avg_confidence,
  COUNT(*) FILTER (WHERE confidence >= 0.8) as high_confidence_count,
  COUNT(*) FILTER (WHERE last_accessed > NOW() - INTERVAL '7 days') as recently_accessed,
  MAX(updated_at) as last_updated
FROM kb_nodes
GROUP BY namespace;

COMMENT ON VIEW kb_health IS 'KB health metrics per namespace';

-- =============================================================================
-- SAMPLE DATA (Remove in production)
-- =============================================================================

-- Uncomment to add sample data for testing:
/*
INSERT INTO kb_nodes (namespace, path, title, content, source_expert, source_url, confidence)
VALUES 
  ('demo', 'retirement/withdrawal/4-percent-rule', 
   'The 4% Rule', 
   'The 4% rule suggests withdrawing 4% of your portfolio in the first year of retirement, then adjusting for inflation each subsequent year.',
   'William Bengen',
   'https://www.financialplanningassociation.org/article/journal/OCT94-determining-withdrawal-rates-using-historical-data',
   0.95),
  ('demo', 'retirement/withdrawal/guardrails',
   'Guardrails Strategy',
   'The guardrails approach adjusts withdrawals based on portfolio performance, increasing spending when markets are up and decreasing when down.',
   'Jonathan Guyton',
   'https://www.financialplanningassociation.org/article/journal/MAR06-decision-rules-and-portfolio-management-retirees-when-change-becomes-necessary',
   0.90)
ON CONFLICT (namespace, path) DO NOTHING;
*/

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  ext_name TEXT;
BEGIN
  -- Check which extension is active
  SELECT extname INTO ext_name FROM pg_extension WHERE extname IN ('ruvector', 'vector') LIMIT 1;
  
  IF ext_name IS NOT NULL THEN
    RAISE NOTICE 'KB-First schema ready with % extension', ext_name;
  ELSE
    RAISE NOTICE 'KB-First schema ready (text search only - no vector extension)';
  END IF;
  
  RAISE NOTICE 'Tables created: kb_nodes, kb_gaps, reasoning_bank, kb_analytics';
  RAISE NOTICE 'Views created: kb_top_gaps, kb_health';
END $$;
