-- KB Optimization Script for ruvector-postgres (real[] embeddings)
-- Run: PGPASSWORD=guruKB2025 psql -h localhost -p 5435 -U postgres -f scripts/kb-optimize.sql
--
-- This script is designed for ruvector-postgres which uses real[] arrays
-- instead of pgvector. It creates optimized indexes and functions for
-- semantic search with 100% recall.

\echo '╔════════════════════════════════════════════════════════════════╗'
\echo '║     KB Optimization Script (ruvector-postgres native)         ║'
\echo '╚════════════════════════════════════════════════════════════════╝'

-- ═══════════════════════════════════════════════════════════════════════
-- Step 1: Create cosine_distance function for real[] arrays
-- ═══════════════════════════════════════════════════════════════════════
\echo ''
\echo 'Step 1: Creating cosine_distance function for real[] arrays...'

DROP FUNCTION IF EXISTS cosine_distance(real[], real[]);

CREATE OR REPLACE FUNCTION cosine_distance(a real[], b real[])
RETURNS double precision AS $$
DECLARE
    dot_product double precision := 0;
    norm_a double precision := 0;
    norm_b double precision := 0;
    len int;
    denominator double precision;
BEGIN
    len := array_length(a, 1);

    -- Handle null or mismatched arrays
    IF a IS NULL OR b IS NULL OR len IS NULL OR len != array_length(b, 1) THEN
        RETURN NULL;
    END IF;

    FOR i IN 1..len LOOP
        dot_product := dot_product + (a[i]::double precision * b[i]::double precision);
        norm_a := norm_a + (a[i]::double precision * a[i]::double precision);
        norm_b := norm_b + (b[i]::double precision * b[i]::double precision);
    END LOOP;

    -- Prevent division by zero
    denominator := sqrt(norm_a) * sqrt(norm_b);
    IF denominator < 1e-10 THEN
        RETURN 1.0;  -- Maximum distance for zero vectors
    END IF;

    RETURN 1.0 - (dot_product / denominator);
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

COMMENT ON FUNCTION cosine_distance(real[], real[]) IS
'Compute cosine distance between two real[] vectors. Returns 0 for identical vectors, 1 for orthogonal, 2 for opposite.';

\echo '✓ cosine_distance function created'

-- ═══════════════════════════════════════════════════════════════════════
-- Step 2: Create semantic search function
-- ═══════════════════════════════════════════════════════════════════════
\echo ''
\echo 'Step 2: Creating semantic_search function...'

DROP FUNCTION IF EXISTS ask_ruvnet.semantic_search(text, int, double precision);

CREATE OR REPLACE FUNCTION ask_ruvnet.semantic_search(
    query_text text,
    limit_count int DEFAULT 10,
    max_distance double precision DEFAULT 0.5
)
RETURNS TABLE (
    id integer,
    title text,
    content text,
    category text,
    quality_score integer,
    distance double precision
) AS $$
DECLARE
    query_embedding real[];
BEGIN
    -- Generate embedding for query using ruvector_embed
    query_embedding := ruvector_embed(query_text)::real[];

    RETURN QUERY
    SELECT
        d.id,
        d.title,
        d.content,
        d.category,
        d.quality_score,
        cosine_distance(d.embedding, query_embedding) as distance
    FROM ask_ruvnet.architecture_docs d
    WHERE d.embedding IS NOT NULL
      AND d.is_duplicate = false
      AND cosine_distance(d.embedding, query_embedding) <= max_distance
    ORDER BY distance
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION ask_ruvnet.semantic_search(text, int, double precision) IS
'Semantic search using ruvector embeddings. Returns top matches with cosine distance.';

\echo '✓ semantic_search function created'

-- ═══════════════════════════════════════════════════════════════════════
-- Step 3: Create B-tree indexes for filtered queries
-- ═══════════════════════════════════════════════════════════════════════
\echo ''
\echo 'Step 3: Creating optimized indexes...'

-- Category + quality composite index for filtered queries
DROP INDEX IF EXISTS ask_ruvnet.idx_category_quality_active;
CREATE INDEX IF NOT EXISTS idx_category_quality_active
ON ask_ruvnet.architecture_docs (category, quality_score DESC)
WHERE is_duplicate = false AND quality_score >= 40;

-- Title search index
DROP INDEX IF EXISTS ask_ruvnet.idx_title_trgm;
CREATE INDEX IF NOT EXISTS idx_title_search
ON ask_ruvnet.architecture_docs USING btree (title);

-- Non-duplicate filter index
DROP INDEX IF EXISTS ask_ruvnet.idx_non_duplicate;
CREATE INDEX IF NOT EXISTS idx_non_duplicate
ON ask_ruvnet.architecture_docs (id)
WHERE is_duplicate = false;

-- Embedding existence index (for filtering)
DROP INDEX IF EXISTS ask_ruvnet.idx_has_embedding;
CREATE INDEX IF NOT EXISTS idx_has_embedding
ON ask_ruvnet.architecture_docs (id)
WHERE embedding IS NOT NULL;

\echo '✓ Indexes created'

-- ═══════════════════════════════════════════════════════════════════════
-- Step 4: Create optimized KB view
-- ═══════════════════════════════════════════════════════════════════════
\echo ''
\echo 'Step 4: Creating optimized KB view...'

DROP VIEW IF EXISTS ask_ruvnet.kb CASCADE;
CREATE VIEW ask_ruvnet.kb AS
SELECT
    id,
    title,
    content,
    category,
    quality_score,
    package_name as source,
    embedding,
    created_at
FROM ask_ruvnet.architecture_docs
WHERE is_duplicate = false
  AND quality_score >= 40
ORDER BY quality_score DESC;

COMMENT ON VIEW ask_ruvnet.kb IS
'Optimized view of high-quality, non-duplicate KB entries';

\echo '✓ KB view created'

-- ═══════════════════════════════════════════════════════════════════════
-- Step 5: Create category distribution materialized view
-- ═══════════════════════════════════════════════════════════════════════
\echo ''
\echo 'Step 5: Creating category stats materialized view...'

DROP MATERIALIZED VIEW IF EXISTS ask_ruvnet.category_stats CASCADE;
CREATE MATERIALIZED VIEW ask_ruvnet.category_stats AS
SELECT
    category,
    COUNT(*) as entry_count,
    ROUND(AVG(quality_score), 1) as avg_quality,
    MIN(quality_score) as min_quality,
    MAX(quality_score) as max_quality,
    COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embedding
FROM ask_ruvnet.architecture_docs
WHERE is_duplicate = false
GROUP BY category
ORDER BY entry_count DESC;

CREATE UNIQUE INDEX idx_category_stats_cat ON ask_ruvnet.category_stats (category);

\echo '✓ Category stats materialized view created'

-- ═══════════════════════════════════════════════════════════════════════
-- Step 6: Vacuum and analyze
-- ═══════════════════════════════════════════════════════════════════════
\echo ''
\echo 'Step 6: Running VACUUM ANALYZE...'
VACUUM ANALYZE ask_ruvnet.architecture_docs;

-- ═══════════════════════════════════════════════════════════════════════
-- Step 7: Report statistics
-- ═══════════════════════════════════════════════════════════════════════
\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo '                    OPTIMIZATION COMPLETE                        '
\echo '════════════════════════════════════════════════════════════════'
\echo ''

SELECT
    'Total entries' as metric,
    TO_CHAR(COUNT(*), 'FM999,999') as value
FROM ask_ruvnet.architecture_docs
UNION ALL
SELECT
    'Active (non-duplicate)',
    TO_CHAR(COUNT(*), 'FM999,999')
FROM ask_ruvnet.architecture_docs WHERE is_duplicate = false
UNION ALL
SELECT
    'High quality (>=40)',
    TO_CHAR(COUNT(*), 'FM999,999')
FROM ask_ruvnet.architecture_docs WHERE is_duplicate = false AND quality_score >= 40
UNION ALL
SELECT
    'With embeddings',
    TO_CHAR(COUNT(*), 'FM999,999')
FROM ask_ruvnet.architecture_docs WHERE embedding IS NOT NULL
UNION ALL
SELECT
    'Categories',
    TO_CHAR(COUNT(DISTINCT category), 'FM999')
FROM ask_ruvnet.architecture_docs WHERE is_duplicate = false;

\echo ''
\echo 'Category distribution:'
SELECT * FROM ask_ruvnet.category_stats;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo '                       USAGE EXAMPLES                            '
\echo '════════════════════════════════════════════════════════════════'
\echo ''
\echo 'Semantic search:'
\echo '  SELECT * FROM ask_ruvnet.semantic_search(''how to create agents'', 5);'
\echo ''
\echo 'Direct cosine distance:'
\echo '  SELECT title, cosine_distance(embedding, (SELECT embedding FROM ask_ruvnet.architecture_docs WHERE id = 1)) as dist'
\echo '  FROM ask_ruvnet.architecture_docs WHERE embedding IS NOT NULL ORDER BY dist LIMIT 5;'
\echo ''
\echo 'Filtered by category:'
\echo '  SELECT * FROM ask_ruvnet.kb WHERE category = ''agents'' LIMIT 10;'
\echo ''
\echo 'Refresh category stats:'
\echo '  REFRESH MATERIALIZED VIEW ask_ruvnet.category_stats;'
\echo ''
