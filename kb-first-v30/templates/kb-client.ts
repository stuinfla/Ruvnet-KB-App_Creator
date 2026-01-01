/**
 * KB-First v2.9 Knowledge Base Client
 * 
 * Production-ready client for RuVector PostgreSQL
 * Optimized for enterprise KB applications
 */

import { Pool, PoolClient } from 'pg';

// =============================================================================
// CONFIGURATION
// =============================================================================

const pool = new Pool({
  connectionString: process.env.RUVECTOR_POSTGRES_URL || process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// =============================================================================
// TYPES
// =============================================================================

export interface KBNode {
  id: string;
  namespace: string;
  path: string;
  title: string;
  content: string | null;
  sourceExpert: string;
  sourceUrl: string;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface SearchResult extends KBNode {
  distance: number;
  relevanceScore: number;
  bm25Score?: number;
}

export interface KBResponse<T> {
  data: T;
  sources: {
    nodeIds: string[];
    experts: string[];
    urls: string[];
  };
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  gap: boolean;
  gapReason?: string;
}

export interface SearchOptions {
  limit?: number;
  minConfidence?: number;
  hybridWeight?: number; // 0-1, weight for semantic vs keyword
}

export interface GapReport {
  query: string;
  reason: string;
  count: number;
  lastSeen: Date;
}

// =============================================================================
// CORE SEARCH FUNCTIONS
// =============================================================================

/**
 * Primary KB search - uses hybrid (semantic + keyword) by default
 */
export async function searchKB(
  query: string,
  namespace: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const { 
    limit = 10, 
    minConfidence = 0,
    hybridWeight = 0.7  // 70% semantic, 30% keyword
  } = options;
  
  const client = await pool.connect();
  
  try {
    // Check if ruvector_embed is available (local embeddings)
    const hasLocalEmbed = await checkFunction(client, 'ruvector_embed');
    
    let result;
    
    if (hasLocalEmbed) {
      // Use local embeddings + hybrid search
      result = await client.query(`
        WITH query_emb AS (
          SELECT ruvector_embed('all-MiniLM-L6-v2', $1) AS emb
        ),
        scored AS (
          SELECT 
            n.id, n.namespace, n.path, n.title, n.content,
            n.source_expert, n.source_url, n.confidence, n.metadata,
            1.0 / (1.0 + (n.embedding <=> q.emb)) AS semantic_score,
            ts_rank(to_tsvector('english', COALESCE(n.title || ' ' || n.content, '')), 
                    plainto_tsquery('english', $1)) AS text_score
          FROM kb_nodes n, query_emb q
          WHERE n.namespace = $2 AND n.confidence >= $3
        )
        SELECT 
          *,
          ($4 * semantic_score + $5 * text_score) AS combined_score,
          1 - semantic_score AS distance
        FROM scored
        WHERE semantic_score > 0.01 OR text_score > 0
        ORDER BY combined_score DESC
        LIMIT $6
      `, [query, namespace, minConfidence, hybridWeight, 1 - hybridWeight, limit]);
    } else {
      // Fallback to text search only (no embeddings available)
      result = await client.query(`
        SELECT 
          id, namespace, path, title, content,
          source_expert, source_url, confidence, metadata,
          ts_rank(to_tsvector('english', COALESCE(title || ' ' || content, '')), 
                  plainto_tsquery('english', $1)) AS text_score,
          0.5 AS distance
        FROM kb_nodes
        WHERE namespace = $2 
          AND confidence >= $3
          AND to_tsvector('english', COALESCE(title || ' ' || content, '')) 
              @@ plainto_tsquery('english', $1)
        ORDER BY text_score DESC
        LIMIT $4
      `, [query, namespace, minConfidence, limit]);
    }
    
    // Update access tracking (fire and forget)
    const nodeIds = result.rows.map(r => r.id);
    if (nodeIds.length > 0) {
      client.query(`
        UPDATE kb_nodes 
        SET access_count = access_count + 1, last_accessed = NOW()
        WHERE id = ANY($1)
      `, [nodeIds]).catch(() => {});
    }
    
    return result.rows.map(row => ({
      id: row.id,
      namespace: row.namespace,
      path: row.path,
      title: row.title,
      content: row.content,
      sourceExpert: row.source_expert,
      sourceUrl: row.source_url,
      confidence: row.confidence,
      metadata: row.metadata || {},
      distance: row.distance,
      relevanceScore: row.combined_score || row.text_score,
      bm25Score: row.text_score
    }));
  } finally {
    client.release();
  }
}

/**
 * Build a KB-grounded response with proper attribution
 */
export async function buildResponse<T>(
  results: SearchResult[],
  answer: T
): Promise<KBResponse<T>> {
  
  if (results.length === 0) {
    return {
      data: answer,
      sources: { nodeIds: [], experts: [], urls: [] },
      confidence: 0,
      confidenceLevel: 'low',
      gap: true,
      gapReason: 'No matching KB content found'
    };
  }
  
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  const weightedConfidence = results.reduce((sum, r, i) => {
    const weight = 1 / (i + 1); // First result weighted more
    return sum + (r.confidence * r.relevanceScore * weight);
  }, 0) / results.reduce((sum, _, i) => sum + 1 / (i + 1), 0);
  
  const confidence = Math.min(avgConfidence, weightedConfidence);
  
  return {
    data: answer,
    sources: {
      nodeIds: results.map(r => r.id),
      experts: [...new Set(results.map(r => r.sourceExpert).filter(Boolean))],
      urls: [...new Set(results.map(r => r.sourceUrl).filter(Boolean))]
    },
    confidence,
    confidenceLevel: confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low',
    gap: false
  };
}

// =============================================================================
// GAP DETECTION
// =============================================================================

/**
 * Log a query that couldn't be answered from the KB
 */
export async function logGap(
  query: string,
  reason: string,
  namespace?: string
): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query(`
      INSERT INTO kb_gaps (query, reason, namespace, first_seen, last_seen, occurrence_count)
      VALUES ($1, $2, $3, NOW(), NOW(), 1)
      ON CONFLICT (query, namespace) DO UPDATE SET
        last_seen = NOW(),
        occurrence_count = kb_gaps.occurrence_count + 1
    `, [query.substring(0, 500), reason, namespace || 'default']);
  } finally {
    client.release();
  }
}

/**
 * Get gap report for KB improvement
 */
export async function getGapReport(
  namespace?: string,
  limit: number = 50
): Promise<GapReport[]> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT query, reason, occurrence_count as count, last_seen
      FROM kb_gaps
      WHERE ($1::text IS NULL OR namespace = $1)
      ORDER BY occurrence_count DESC, last_seen DESC
      LIMIT $2
    `, [namespace, limit]);
    
    return result.rows.map(row => ({
      query: row.query,
      reason: row.reason,
      count: parseInt(row.count),
      lastSeen: row.last_seen
    }));
  } finally {
    client.release();
  }
}

// =============================================================================
// REASONING BANK (Pattern Storage)
// =============================================================================

/**
 * Store a successful query-response pattern
 */
export async function storePattern(
  query: string,
  response: string,
  nodesUsed: string[],
  feedbackScore: number
): Promise<void> {
  if (feedbackScore < 0.7) return; // Only store good patterns
  
  const client = await pool.connect();
  
  try {
    await client.query(`
      INSERT INTO reasoning_bank (query_pattern, successful_response, kb_nodes_used, feedback_score, use_count)
      VALUES ($1, $2, $3, $4, 1)
      ON CONFLICT (query_pattern) DO UPDATE SET
        feedback_score = (reasoning_bank.feedback_score * reasoning_bank.use_count + $4) 
                         / (reasoning_bank.use_count + 1),
        use_count = reasoning_bank.use_count + 1,
        updated_at = NOW()
    `, [query.substring(0, 500), response.substring(0, 2000), nodesUsed, feedbackScore]);
  } finally {
    client.release();
  }
}

/**
 * Find similar successful patterns
 */
export async function findSimilarPatterns(
  query: string,
  limit: number = 3
): Promise<{ pattern: string; response: string; score: number }[]> {
  const client = await pool.connect();
  
  try {
    // Try vector similarity if available
    const hasEmbed = await checkFunction(client, 'ruvector_embed');
    
    if (hasEmbed) {
      const result = await client.query(`
        SELECT 
          query_pattern as pattern,
          successful_response as response,
          feedback_score as score
        FROM reasoning_bank
        WHERE feedback_score >= 0.7
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ruvector_embed('all-MiniLM-L6-v2', $1)
        LIMIT $2
      `, [query, limit]);
      
      return result.rows;
    }
    
    // Fallback to text similarity
    const result = await client.query(`
      SELECT 
        query_pattern as pattern,
        successful_response as response,
        feedback_score as score,
        similarity(query_pattern, $1) as sim
      FROM reasoning_bank
      WHERE feedback_score >= 0.7
      ORDER BY similarity(query_pattern, $1) DESC
      LIMIT $2
    `, [query, limit]);
    
    return result.rows;
  } catch {
    return []; // No patterns found
  } finally {
    client.release();
  }
}

// =============================================================================
// HEALTH & DIAGNOSTICS
// =============================================================================

/**
 * Check KB health and capabilities
 */
export async function checkHealth(namespace?: string): Promise<{
  healthy: boolean;
  nodeCount: number;
  gapCount: number;
  patternCount: number;
  features: {
    vectorSearch: boolean;
    localEmbeddings: boolean;
    hybridSearch: boolean;
  };
  error?: string;
}> {
  const client = await pool.connect();
  
  try {
    // Test connection
    await client.query('SELECT 1');
    
    // Count nodes
    const nodeResult = namespace
      ? await client.query('SELECT COUNT(*) FROM kb_nodes WHERE namespace = $1', [namespace])
      : await client.query('SELECT COUNT(*) FROM kb_nodes');
    
    // Count gaps
    const gapResult = await client.query('SELECT COUNT(*) FROM kb_gaps');
    
    // Count patterns
    let patternCount = 0;
    try {
      const patternResult = await client.query('SELECT COUNT(*) FROM reasoning_bank');
      patternCount = parseInt(patternResult.rows[0].count);
    } catch { /* table may not exist */ }
    
    // Check features
    const hasVector = await checkFunction(client, 'vector_cosine_ops');
    const hasEmbed = await checkFunction(client, 'ruvector_embed');
    
    return {
      healthy: true,
      nodeCount: parseInt(nodeResult.rows[0].count),
      gapCount: parseInt(gapResult.rows[0].count),
      patternCount,
      features: {
        vectorSearch: hasVector,
        localEmbeddings: hasEmbed,
        hybridSearch: true // Always available via ts_rank
      }
    };
  } catch (e) {
    return {
      healthy: false,
      nodeCount: 0,
      gapCount: 0,
      patternCount: 0,
      features: { vectorSearch: false, localEmbeddings: false, hybridSearch: false },
      error: e instanceof Error ? e.message : 'Unknown error'
    };
  } finally {
    client.release();
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

async function checkFunction(client: PoolClient, funcName: string): Promise<boolean> {
  try {
    const result = await client.query(`
      SELECT EXISTS(
        SELECT 1 FROM pg_proc WHERE proname = $1
      ) OR EXISTS(
        SELECT 1 FROM pg_operator WHERE oprname = $1
      ) AS exists
    `, [funcName]);
    return result.rows[0]?.exists || false;
  } catch {
    return false;
  }
}

/**
 * Initialize KB schema (run once)
 */
export async function initializeSchema(): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query(`
      -- Enable extensions
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For text similarity
      
      -- Try to enable ruvector (may not be available)
      DO $$ BEGIN
        CREATE EXTENSION IF NOT EXISTS ruvector;
      EXCEPTION WHEN OTHERS THEN
        -- Fall back to pgvector
        CREATE EXTENSION IF NOT EXISTS vector;
      END $$;
      
      -- KB Nodes table
      CREATE TABLE IF NOT EXISTS kb_nodes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        namespace TEXT NOT NULL DEFAULT 'default',
        path TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        source_expert TEXT NOT NULL,
        source_url TEXT NOT NULL,
        confidence REAL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
        metadata JSONB DEFAULT '{}',
        embedding vector(384),
        access_count INTEGER DEFAULT 0,
        last_accessed TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(namespace, path)
      );
      
      -- Gaps table
      CREATE TABLE IF NOT EXISTS kb_gaps (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        query TEXT NOT NULL,
        reason TEXT,
        namespace TEXT DEFAULT 'default',
        first_seen TIMESTAMPTZ DEFAULT NOW(),
        last_seen TIMESTAMPTZ DEFAULT NOW(),
        occurrence_count INTEGER DEFAULT 1,
        resolved BOOLEAN DEFAULT false,
        UNIQUE(query, namespace)
      );
      
      -- Reasoning bank
      CREATE TABLE IF NOT EXISTS reasoning_bank (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        query_pattern TEXT UNIQUE NOT NULL,
        successful_response TEXT NOT NULL,
        kb_nodes_used UUID[] DEFAULT '{}',
        feedback_score REAL DEFAULT 0.5,
        use_count INTEGER DEFAULT 1,
        embedding vector(384),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Indexes
      CREATE INDEX IF NOT EXISTS kb_nodes_namespace_idx ON kb_nodes(namespace);
      CREATE INDEX IF NOT EXISTS kb_nodes_content_trgm_idx ON kb_nodes USING gin(content gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS kb_gaps_namespace_idx ON kb_gaps(namespace);
      CREATE INDEX IF NOT EXISTS kb_gaps_count_idx ON kb_gaps(occurrence_count DESC);
      
      -- Vector index (if vector type exists)
      DO $$ BEGIN
        CREATE INDEX IF NOT EXISTS kb_nodes_embedding_idx ON kb_nodes 
        USING hnsw (embedding vector_cosine_ops);
      EXCEPTION WHEN OTHERS THEN
        NULL; -- Vector extension not available
      END $$;
    `);
    
    console.log('[KB-FIRST] Schema initialized successfully');
  } finally {
    client.release();
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  searchKB,
  buildResponse,
  logGap,
  getGapReport,
  storePattern,
  findSimilarPatterns,
  checkHealth,
  initializeSchema
};
