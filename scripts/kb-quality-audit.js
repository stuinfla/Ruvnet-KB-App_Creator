#!/usr/bin/env node

/**
 * KB Quality Audit & Optimization
 *
 * Scores ANY existing knowledge base and provides specific optimization steps.
 *
 * Usage:
 *   node scripts/kb-quality-audit.js --schema ask_ruvnet
 *   node scripts/kb-quality-audit.js --schema ask_ruvnet --fix
 *   node scripts/kb-quality-audit.js --schema ask_ruvnet --detailed
 *
 * Scores 7 Dimensions:
 *   1. Embedding Quality     - Are embeddings complete and well-distributed?
 *   2. Deduplication         - Hash-based duplicate detection
 *   3. Category Coverage     - Balanced distribution across domains
 *   4. Structural Integrity  - Hierarchy, relationships, navigation paths
 *   5. Content Quality       - Length, formatting, source attribution
 *   6. Recall Performance    - Search returns relevant results
 *   7. Index Optimization    - HNSW parameters, quantization readiness
 */

import pg from 'pg';
import chalk from 'chalk';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  db: {
    host: process.env.KB_HOST || 'localhost',
    port: parseInt(process.env.KB_PORT || '5435'),
    database: 'postgres',
    user: 'postgres',
    password: process.env.KB_PASSWORD || 'guruKB2025',
  },
};

// ============================================================================
// Audit Dimensions
// ============================================================================

class KBAudit {
  constructor(client, schema, tableName = null) {
    this.client = client;
    this.schema = schema;
    this.tableName = tableName;
    this.fullTable = null; // Set during detection
    this.scores = {};
    this.issues = [];
    this.fixes = [];
  }

  async detectTable() {
    // Auto-detect the main KB table
    const tables = await this.client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
      ORDER BY
        CASE
          WHEN table_name = 'kb_entries' THEN 1
          WHEN table_name = 'architecture_docs' THEN 2
          WHEN table_name LIKE '%kb%' THEN 3
          WHEN table_name LIKE '%entries%' THEN 4
          ELSE 5
        END
    `, [this.schema]);

    if (tables.rows.length === 0) {
      throw new Error(`No tables found in schema ${this.schema}`);
    }

    this.tableName = this.tableName || tables.rows[0].table_name;
    this.fullTable = `${this.schema}.${this.tableName}`;
    console.log(chalk.gray(`  Table:  ${this.fullTable}\n`));

    // Detect column mappings
    const columns = await this.client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
    `, [this.schema, this.tableName]);

    this.columns = columns.rows.map(r => r.column_name);

    // Map standard columns to actual columns
    this.colMap = {
      hash: this.columns.includes('content_hash') ? 'content_hash' :
            this.columns.includes('file_hash') ? 'file_hash' : null,
      path: this.columns.includes('source_path') ? 'source_path' :
            this.columns.includes('file_path') ? 'file_path' : null,
      expert: this.columns.includes('source_expert') ? 'source_expert' :
              this.columns.includes('package_name') ? 'package_name' : null,
      url: this.columns.includes('source_url') ? 'source_url' : null,
      isDuplicate: this.columns.includes('is_duplicate') ? 'is_duplicate' : null,
    };

    return this.tableName;
  }

  // ---------------------------------------------------------------------------
  // 1. Embedding Quality (0-100)
  // ---------------------------------------------------------------------------
  async auditEmbeddings() {
    const dimension = 'Embedding Quality';
    let score = 100;
    const details = [];

    // Check for null embeddings
    const nullEmbeddings = await this.client.query(`
      SELECT COUNT(*) as count FROM ${this.fullTable}
      WHERE embedding IS NULL OR array_length(embedding, 1) IS NULL
    `);
    const nullCount = parseInt(nullEmbeddings.rows[0].count);

    const totalResult = await this.client.query(`
      SELECT COUNT(*) as count FROM ${this.fullTable}
    `);
    const total = parseInt(totalResult.rows[0].count);

    if (nullCount > 0) {
      const penalty = Math.min(50, (nullCount / total) * 100);
      score -= penalty;
      this.issues.push({
        dimension,
        severity: 'HIGH',
        message: `${nullCount} entries (${((nullCount/total)*100).toFixed(1)}%) have NULL embeddings`,
      });
      this.fixes.push({
        dimension,
        sql: `UPDATE ${this.fullTable} SET embedding = ruvector_embed(content) WHERE embedding IS NULL`,
        description: 'Generate embeddings for entries missing them',
      });
    }

    // Check embedding dimensions consistency
    const dimCheck = await this.client.query(`
      SELECT array_length(embedding, 1) as dims, COUNT(*) as count
      FROM ${this.fullTable}
      WHERE embedding IS NOT NULL
      GROUP BY array_length(embedding, 1)
    `);

    if (dimCheck.rows.length > 1) {
      score -= 20;
      this.issues.push({
        dimension,
        severity: 'HIGH',
        message: `Inconsistent embedding dimensions: ${dimCheck.rows.map(r => `${r.dims}D (${r.count})`).join(', ')}`,
      });
      details.push(`Multiple dimensions found - re-embed with consistent model`);
    } else if (dimCheck.rows.length === 1) {
      details.push(`Consistent ${dimCheck.rows[0].dims}D embeddings`);
    }

    // Check embedding distribution (variance)
    const varianceCheck = await this.client.query(`
      SELECT
        AVG(embedding[1]) as mean_dim1,
        STDDEV(embedding[1]) as std_dim1
      FROM ${this.fullTable}
      WHERE embedding IS NOT NULL
      LIMIT 10000
    `);

    if (varianceCheck.rows[0].std_dim1 !== null) {
      const std = parseFloat(varianceCheck.rows[0].std_dim1);
      if (std < 0.1) {
        score -= 15;
        this.issues.push({
          dimension,
          severity: 'MEDIUM',
          message: `Low embedding variance (${std.toFixed(3)}) - may indicate poor model or data quality`,
        });
      } else {
        details.push(`Healthy embedding variance: ${std.toFixed(3)}`);
      }
    }

    this.scores.embeddings = { score: Math.max(0, score), dimension, details };
    return score;
  }

  // ---------------------------------------------------------------------------
  // 2. Deduplication (0-100)
  // ---------------------------------------------------------------------------
  async auditDeduplication() {
    const dimension = 'Deduplication';
    let score = 100;
    const details = [];

    const hashCol = this.colMap.hash || 'content_hash';

    // Check if we have built-in duplicate tracking
    if (this.colMap.isDuplicate) {
      const dupCount = await this.client.query(`
        SELECT COUNT(*) as count FROM ${this.fullTable}
        WHERE ${this.colMap.isDuplicate} = true
      `);
      const dups = parseInt(dupCount.rows[0].count);
      if (dups > 0) {
        details.push(`${dups} entries marked as duplicates (already handled)`);
      }
    }

    // Check for duplicate content hashes
    const hashCheck = await this.client.query(`
      SELECT ${hashCol}, COUNT(*) as count
      FROM ${this.fullTable}
      WHERE ${hashCol} IS NOT NULL
      GROUP BY ${hashCol}
      HAVING COUNT(*) > 1
      LIMIT 50
    `);

    if (hashCheck.rows.length > 0) {
      const totalDups = hashCheck.rows.reduce((sum, r) => sum + parseInt(r.count) - 1, 0);
      const penalty = Math.min(40, totalDups / 10);
      score -= penalty;
      this.issues.push({
        dimension,
        severity: 'MEDIUM',
        message: `${totalDups} duplicate entries found (${hashCheck.rows.length} unique hashes with duplicates)`,
      });
      this.fixes.push({
        dimension,
        sql: `
          DELETE FROM ${this.fullTable} a
          USING ${this.fullTable} b
          WHERE a.${hashCol} = b.${hashCol}
            AND a.id > b.id
            AND a.quality_score <= b.quality_score`,
        description: 'Remove duplicate entries (keeps higher quality)',
      });
    } else {
      details.push('No duplicate content detected');
    }

    // Check for missing content hashes
    const missingHash = await this.client.query(`
      SELECT COUNT(*) as count FROM ${this.fullTable}
      WHERE ${hashCol} IS NULL
    `);
    const missingCount = parseInt(missingHash.rows[0].count);

    if (missingCount > 0) {
      score -= 20;
      this.issues.push({
        dimension,
        severity: 'HIGH',
        message: `${missingCount} entries missing ${hashCol} (cannot deduplicate)`,
      });
      this.fixes.push({
        dimension,
        sql: `
          UPDATE ${this.fullTable}
          SET ${hashCol} = encode(sha256(lower(regexp_replace(content, '\\s+', ' ', 'g'))::bytea), 'hex')
          WHERE ${hashCol} IS NULL`,
        description: 'Generate content hashes for deduplication',
      });
    }

    // Check for near-duplicates (similar titles)
    const titleDups = await this.client.query(`
      SELECT title, COUNT(*) as count
      FROM ${this.fullTable}
      GROUP BY title
      HAVING COUNT(*) > 1
      LIMIT 20
    `);

    if (titleDups.rows.length > 0) {
      score -= 10;
      this.issues.push({
        dimension,
        severity: 'LOW',
        message: `${titleDups.rows.length} titles appear multiple times (may be near-duplicates)`,
      });
      details.push(`Example: "${titleDups.rows[0].title}" (${titleDups.rows[0].count}x)`);
    }

    this.scores.deduplication = { score: Math.max(0, score), dimension, details };
    return score;
  }

  // ---------------------------------------------------------------------------
  // 3. Category Coverage (0-100)
  // ---------------------------------------------------------------------------
  async auditCategories() {
    const dimension = 'Category Coverage';
    let score = 100;
    const details = [];

    // Get category distribution
    const catDist = await this.client.query(`
      SELECT
        COALESCE(category, 'uncategorized') as category,
        COUNT(*) as count
      FROM ${this.fullTable}
      GROUP BY category
      ORDER BY count DESC
    `);

    const total = catDist.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    const categories = catDist.rows.map(r => ({
      name: r.category,
      count: parseInt(r.count),
      pct: (parseInt(r.count) / total * 100).toFixed(1),
    }));

    // Check for uncategorized
    const uncategorized = categories.find(c => c.name === 'uncategorized' || c.name === 'general');
    if (uncategorized && parseFloat(uncategorized.pct) > 30) {
      score -= 20;
      this.issues.push({
        dimension,
        severity: 'MEDIUM',
        message: `${uncategorized.pct}% entries are uncategorized/general`,
      });
      this.fixes.push({
        dimension,
        sql: `-- Re-categorize based on content patterns (requires custom logic)`,
        description: 'Run categorization algorithm on uncategorized entries',
      });
    }

    // Check category balance (Gini coefficient)
    const sortedCounts = categories.map(c => c.count).sort((a, b) => a - b);
    const n = sortedCounts.length;
    let gini = 0;
    if (n > 1) {
      const cumSum = sortedCounts.reduce((acc, v, i) => {
        acc.push((acc[i] || 0) + v);
        return acc;
      }, []);
      const sumOfSums = cumSum.reduce((a, b) => a + b, 0);
      gini = (n + 1 - 2 * sumOfSums / cumSum[n - 1]) / n;
    }

    if (gini > 0.5) {
      score -= Math.min(25, gini * 30);
      this.issues.push({
        dimension,
        severity: 'MEDIUM',
        message: `Imbalanced category distribution (Gini: ${gini.toFixed(2)})`,
      });
      details.push(`Top category "${categories[0].name}" has ${categories[0].pct}% of entries`);
    } else {
      details.push(`Category balance is good (Gini: ${gini.toFixed(2)})`);
    }

    // Check minimum categories
    if (categories.length < 5) {
      score -= 15;
      this.issues.push({
        dimension,
        severity: 'LOW',
        message: `Only ${categories.length} categories - consider more granular categorization`,
      });
    }

    details.push(`${categories.length} categories: ${categories.slice(0, 5).map(c => `${c.name}(${c.count})`).join(', ')}`);

    this.scores.categories = { score: Math.max(0, score), dimension, details, breakdown: categories };
    return score;
  }

  // ---------------------------------------------------------------------------
  // 4. Structural Integrity (0-100)
  // ---------------------------------------------------------------------------
  async auditStructure() {
    const dimension = 'Structural Integrity';
    let score = 100;
    const details = [];

    const pathCol = this.colMap.path || 'source_path';

    // Check for hierarchical structure (path field)
    const hasPath = await this.client.query(`
      SELECT COUNT(*) as count FROM ${this.fullTable}
      WHERE ${pathCol} IS NOT NULL AND ${pathCol} != ''
    `);
    const pathCount = parseInt(hasPath.rows[0].count);
    const totalResult = await this.client.query(`SELECT COUNT(*) as count FROM ${this.fullTable}`);
    const total = parseInt(totalResult.rows[0].count);

    if (pathCount < total * 0.5) {
      score -= 15;
      this.issues.push({
        dimension,
        severity: 'MEDIUM',
        message: `Only ${((pathCount/total)*100).toFixed(0)}% entries have navigation paths`,
      });
    } else {
      details.push(`${((pathCount/total)*100).toFixed(0)}% entries have paths`);
    }

    // Check for source attribution
    const expertCol = this.colMap.expert || 'source_expert';
    const hasExpert = await this.client.query(`
      SELECT COUNT(*) as count FROM ${this.fullTable}
      WHERE ${expertCol} IS NOT NULL AND ${expertCol} != ''
    `);
    const expertCount = parseInt(hasExpert.rows[0].count);

    if (expertCount < total * 0.3) {
      score -= 15;
      this.issues.push({
        dimension,
        severity: 'MEDIUM',
        message: `Only ${((expertCount/total)*100).toFixed(0)}% entries have source attribution`,
      });
      this.fixes.push({
        dimension,
        description: 'Add source attribution field to entries during ingestion',
        sql: `-- Requires manual attribution or extraction from content`,
      });
    } else {
      details.push(`${((expertCount/total)*100).toFixed(0)}% entries have source attribution`);
    }

    // Check for URLs (if column exists)
    const urlCol = this.colMap.url;
    if (urlCol) {
      const hasUrl = await this.client.query(`
        SELECT COUNT(*) as count FROM ${this.fullTable}
        WHERE ${urlCol} IS NOT NULL AND ${urlCol} != ''
      `);
      const urlCount = parseInt(hasUrl.rows[0].count);

      if (urlCount < total * 0.2) {
        score -= 10;
        this.issues.push({
          dimension,
          severity: 'LOW',
          message: `Only ${((urlCount/total)*100).toFixed(0)}% entries have source URLs`,
        });
      }
    }

    // Check for orphan entries (no category, no path)
    const orphans = await this.client.query(`
      SELECT COUNT(*) as count FROM ${this.fullTable}
      WHERE (category IS NULL OR category = 'general')
        AND (${pathCol} IS NULL OR ${pathCol} = '')
    `);
    const orphanCount = parseInt(orphans.rows[0].count);

    if (orphanCount > total * 0.1) {
      score -= 15;
      this.issues.push({
        dimension,
        severity: 'MEDIUM',
        message: `${orphanCount} orphan entries (no category or path)`,
      });
    }

    this.scores.structure = { score: Math.max(0, score), dimension, details };
    return score;
  }

  // ---------------------------------------------------------------------------
  // 5. Content Quality (0-100)
  // ---------------------------------------------------------------------------
  async auditContent() {
    const dimension = 'Content Quality';
    let score = 100;
    const details = [];

    // Length distribution
    const lengthStats = await this.client.query(`
      SELECT
        AVG(length(content)) as avg_len,
        MIN(length(content)) as min_len,
        MAX(length(content)) as max_len,
        STDDEV(length(content)) as std_len,
        COUNT(*) FILTER (WHERE length(content) < 100) as too_short,
        COUNT(*) FILTER (WHERE length(content) > 50000) as too_long,
        COUNT(*) as total
      FROM ${this.fullTable}
    `);

    const stats = lengthStats.rows[0];
    const tooShortPct = (parseInt(stats.too_short) / parseInt(stats.total)) * 100;
    const tooLongPct = (parseInt(stats.too_long) / parseInt(stats.total)) * 100;

    if (tooShortPct > 10) {
      score -= Math.min(20, tooShortPct);
      this.issues.push({
        dimension,
        severity: 'MEDIUM',
        message: `${tooShortPct.toFixed(1)}% entries are too short (<100 chars)`,
      });
      this.fixes.push({
        dimension,
        sql: `DELETE FROM ${this.fullTable} WHERE length(content) < 100`,
        description: 'Remove entries too short to be useful',
      });
    }

    if (tooLongPct > 5) {
      score -= Math.min(10, tooLongPct);
      this.issues.push({
        dimension,
        severity: 'LOW',
        message: `${tooLongPct.toFixed(1)}% entries are very long (>50K chars) - consider chunking`,
      });
    }

    details.push(`Avg length: ${parseInt(stats.avg_len).toLocaleString()} chars`);

    // Quality score distribution
    const qualityStats = await this.client.query(`
      SELECT
        AVG(quality_score) as avg_score,
        COUNT(*) FILTER (WHERE quality_score < 40) as low_quality,
        COUNT(*) FILTER (WHERE quality_score >= 80) as high_quality,
        COUNT(*) as total
      FROM ${this.fullTable}
      WHERE quality_score IS NOT NULL
    `);

    const qStats = qualityStats.rows[0];
    if (qStats.avg_score !== null) {
      const avgQuality = parseFloat(qStats.avg_score);
      const lowQualityPct = (parseInt(qStats.low_quality) / parseInt(qStats.total)) * 100;

      if (avgQuality < 50) {
        score -= 20;
        this.issues.push({
          dimension,
          severity: 'HIGH',
          message: `Average quality score is only ${avgQuality.toFixed(0)}/100`,
        });
      }

      if (lowQualityPct > 20) {
        score -= 15;
        this.issues.push({
          dimension,
          severity: 'MEDIUM',
          message: `${lowQualityPct.toFixed(0)}% entries have low quality scores (<40)`,
        });
      }

      details.push(`Avg quality: ${avgQuality.toFixed(0)}/100, High quality: ${parseInt(qStats.high_quality)}`);
    } else {
      score -= 30;
      this.issues.push({
        dimension,
        severity: 'HIGH',
        message: 'No quality scores - run quality scoring on entries',
      });
    }

    this.scores.content = { score: Math.max(0, score), dimension, details };
    return score;
  }

  // ---------------------------------------------------------------------------
  // 6. Recall Performance (0-100)
  // ---------------------------------------------------------------------------
  async auditRecall() {
    const dimension = 'Recall Performance';
    let score = 100;
    const details = [];

    // Test queries with expected results
    const testQueries = [
      { query: 'agent orchestration swarm', expected_category: 'agents' },
      { query: 'vector embedding semantic search', expected_category: 'embeddings' },
      { query: 'authentication security token', expected_category: 'security' },
      { query: 'deployment docker kubernetes', expected_category: 'deployment' },
      { query: 'api endpoint rest graphql', expected_category: 'api' },
    ];

    let passedTests = 0;

    for (const test of testQueries) {
      try {
        // Use cosine_distance for ruvector-postgres (real[] embeddings)
        const result = await this.client.query(`
          SELECT category, title,
                 cosine_distance(embedding, ruvector_embed($1)::real[]) as distance
          FROM ${this.fullTable}
          WHERE embedding IS NOT NULL
          ORDER BY cosine_distance(embedding, ruvector_embed($1)::real[])
          LIMIT 5
        `, [test.query]);

        if (result.rows.length > 0) {
          const topCategory = result.rows[0].category;
          const topCategories = result.rows.map(r => r.category);

          if (topCategory === test.expected_category || topCategories.includes(test.expected_category)) {
            passedTests++;
          } else {
            details.push(`Query "${test.query}" returned ${topCategory} instead of ${test.expected_category}`);
          }
        }
      } catch (e) {
        // ruvector_embed may not exist
        score -= 20;
        this.issues.push({
          dimension,
          severity: 'HIGH',
          message: `Cannot test recall - ruvector_embed() function missing or error: ${e.message}`,
        });
        break;
      }
    }

    const recallRate = (passedTests / testQueries.length) * 100;
    if (recallRate < 80) {
      score -= (80 - recallRate);
      this.issues.push({
        dimension,
        severity: recallRate < 50 ? 'HIGH' : 'MEDIUM',
        message: `Recall rate: ${recallRate.toFixed(0)}% (${passedTests}/${testQueries.length} tests passed)`,
      });
    } else {
      details.push(`Recall rate: ${recallRate.toFixed(0)}% - good performance`);
    }

    // Check for supporting indexes (ruvector uses real[] without HNSW)
    // Note: ruvector-postgres uses brute-force cosine search which is fast for <500K entries
    const indexCheck = await this.client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = $1
        AND schemaname = $2
        AND (indexdef LIKE '%embedding%' OR indexdef LIKE '%is_duplicate%')
    `, [this.tableName, this.schema]);

    if (indexCheck.rows.length === 0) {
      score -= 10;
      this.issues.push({
        dimension,
        severity: 'LOW',
        message: 'No embedding filter indexes - consider adding partial indexes',
      });
      this.fixes.push({
        dimension,
        sql: `CREATE INDEX idx_${this.schema}_has_embedding ON ${this.fullTable}(id) WHERE embedding IS NOT NULL`,
        description: 'Create partial index for entries with embeddings',
      });
    } else {
      details.push(`${indexCheck.rows.length} embedding-related indexes present`);
    }

    // Note about ruvector architecture
    details.push('Using ruvector cosine_distance() for semantic search (real[] arrays)');

    this.scores.recall = { score: Math.max(0, score), dimension, details };
    return score;
  }

  // ---------------------------------------------------------------------------
  // 7. Index Optimization (0-100)
  // ---------------------------------------------------------------------------
  async auditIndexes() {
    const dimension = 'Index Optimization';
    let score = 100;
    const details = [];

    // Check all indexes
    const indexes = await this.client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = $1
        AND tablename = $2
    `, [this.schema, this.tableName]);

    // ruvector-postgres uses real[] arrays with cosine_distance() function
    // HNSW requires pgvector extension which is not available in ruvector
    const hasEmbeddingIdx = indexes.rows.some(r => r.indexdef.includes('embedding'));
    const hasCategory = indexes.rows.some(r => r.indexdef.includes('category'));
    const hashCol = this.colMap.hash || 'content_hash';
    const hasHash = indexes.rows.some(r => r.indexdef.includes(hashCol) || r.indexdef.includes('file_hash'));
    const hasQuality = indexes.rows.some(r => r.indexdef.includes('quality_score'));
    const hasNonDuplicate = indexes.rows.some(r => r.indexdef.includes('is_duplicate'));

    if (!hasEmbeddingIdx && !hasNonDuplicate) {
      score -= 15;
      this.issues.push({ dimension, severity: 'MEDIUM', message: 'Missing embedding filter indexes' });
      this.fixes.push({
        dimension,
        sql: `CREATE INDEX idx_${this.schema}_has_embedding ON ${this.fullTable}(id) WHERE embedding IS NOT NULL`,
        description: 'Create partial index for embedding existence filter',
      });
    }

    if (!hasCategory) {
      score -= 10;
      this.fixes.push({
        dimension,
        sql: `CREATE INDEX idx_${this.schema}_kb_category ON ${this.fullTable}(category)`,
        description: 'Create category index for filtered queries',
      });
    }

    if (!hasHash) {
      score -= 10;
      this.fixes.push({
        dimension,
        sql: `CREATE UNIQUE INDEX idx_${this.schema}_kb_hash ON ${this.fullTable}(${hashCol})`,
        description: 'Create hash index for deduplication',
      });
    }

    if (!hasQuality) {
      score -= 5;
      this.fixes.push({
        dimension,
        sql: `CREATE INDEX idx_${this.schema}_kb_quality ON ${this.fullTable}(quality_score DESC)`,
        description: 'Create quality score index for filtering',
      });
    }

    // Check table statistics
    const tableStats = await this.client.query(`
      SELECT
        pg_size_pretty(pg_total_relation_size('${this.fullTable}')) as total_size,
        pg_size_pretty(pg_table_size('${this.fullTable}')) as table_size,
        pg_size_pretty(pg_indexes_size('${this.fullTable}')) as index_size
    `);

    const stats = tableStats.rows[0];
    details.push(`Table size: ${stats.table_size}, Index size: ${stats.index_size}`);
    details.push(`Indexes: ${indexes.rows.length} (HNSW: ${hasHnsw ? 'yes' : 'no'})`);

    // Check for quantization readiness
    const embeddingDims = await this.client.query(`
      SELECT array_length(embedding, 1) as dims
      FROM ${this.fullTable}
      WHERE embedding IS NOT NULL
      LIMIT 1
    `);

    if (embeddingDims.rows.length > 0) {
      const dims = embeddingDims.rows[0].dims;
      details.push(`Embedding dims: ${dims} (${dims === 384 ? 'optimal for quantization' : dims > 768 ? 'consider dimensionality reduction' : 'OK'})`);
    }

    this.scores.indexes = { score: Math.max(0, score), dimension, details };
    return score;
  }

  // ---------------------------------------------------------------------------
  // Run Full Audit
  // ---------------------------------------------------------------------------
  async runFullAudit() {
    console.log(chalk.cyan('\n╔════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║           KB Quality Audit & Optimization Report               ║'));
    console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.gray(`  Schema: ${this.schema}`));
    console.log(chalk.gray(`  Time:   ${new Date().toISOString()}`));

    // Auto-detect table structure
    await this.detectTable();

    // Run all audits
    await this.auditEmbeddings();
    await this.auditDeduplication();
    await this.auditCategories();
    await this.auditStructure();
    await this.auditContent();
    await this.auditRecall();
    await this.auditIndexes();

    // Calculate overall score
    const dimensions = Object.values(this.scores);
    const overallScore = Math.round(
      dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length
    );

    // Print dimension scores
    console.log(chalk.white.bold('  DIMENSION SCORES'));
    console.log(chalk.gray('  ──────────────────────────────────────────────────────────────\n'));

    for (const dim of dimensions) {
      const bar = this.renderBar(dim.score);
      const color = dim.score >= 80 ? chalk.green : dim.score >= 60 ? chalk.yellow : chalk.red;
      console.log(`    ${dim.dimension.padEnd(22)} ${bar} ${color(dim.score.toString().padStart(3))}/100`);

      if (dim.details && dim.details.length > 0) {
        for (const detail of dim.details) {
          console.log(chalk.gray(`                           └─ ${detail}`));
        }
      }
    }

    // Overall score
    console.log(chalk.gray('\n  ──────────────────────────────────────────────────────────────'));
    const overallBar = this.renderBar(overallScore);
    const overallColor = overallScore >= 80 ? chalk.green : overallScore >= 60 ? chalk.yellow : chalk.red;
    console.log(`    ${chalk.bold('OVERALL SCORE'.padEnd(22))} ${overallBar} ${overallColor.bold(overallScore.toString().padStart(3))}/100`);
    console.log(chalk.gray('  ──────────────────────────────────────────────────────────────\n'));

    // Print issues
    if (this.issues.length > 0) {
      console.log(chalk.white.bold('  ISSUES FOUND'));
      console.log(chalk.gray('  ──────────────────────────────────────────────────────────────\n'));

      const highIssues = this.issues.filter(i => i.severity === 'HIGH');
      const mediumIssues = this.issues.filter(i => i.severity === 'MEDIUM');
      const lowIssues = this.issues.filter(i => i.severity === 'LOW');

      for (const issue of highIssues) {
        console.log(chalk.red(`    ✗ [HIGH] ${issue.message}`));
      }
      for (const issue of mediumIssues) {
        console.log(chalk.yellow(`    ⚠ [MED]  ${issue.message}`));
      }
      for (const issue of lowIssues) {
        console.log(chalk.blue(`    ○ [LOW]  ${issue.message}`));
      }
      console.log();
    }

    // Print fixes
    if (this.fixes.length > 0) {
      console.log(chalk.white.bold('  RECOMMENDED FIXES'));
      console.log(chalk.gray('  ──────────────────────────────────────────────────────────────\n'));

      for (let i = 0; i < this.fixes.length; i++) {
        const fix = this.fixes[i];
        console.log(chalk.cyan(`    ${i + 1}. ${fix.description}`));
        console.log(chalk.gray(`       ${fix.sql.split('\n')[0].trim()}`));
        console.log();
      }
    }

    // Grade
    const grade = overallScore >= 95 ? 'A+' :
                  overallScore >= 90 ? 'A' :
                  overallScore >= 85 ? 'A-' :
                  overallScore >= 80 ? 'B+' :
                  overallScore >= 75 ? 'B' :
                  overallScore >= 70 ? 'B-' :
                  overallScore >= 65 ? 'C+' :
                  overallScore >= 60 ? 'C' :
                  overallScore >= 55 ? 'C-' :
                  overallScore >= 50 ? 'D' : 'F';

    console.log(chalk.gray('  ══════════════════════════════════════════════════════════════'));
    console.log(`    ${chalk.bold('GRADE:')} ${overallColor.bold(grade)}  |  ${chalk.bold('Score:')} ${overallColor(overallScore)}/100  |  ${chalk.bold('Issues:')} ${this.issues.length}`);
    console.log(chalk.gray('  ══════════════════════════════════════════════════════════════\n'));

    return { overallScore, grade, scores: this.scores, issues: this.issues, fixes: this.fixes };
  }

  renderBar(score) {
    const filled = Math.round(score / 5);
    const empty = 20 - filled;
    const color = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
    return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }
}

// ============================================================================
// Apply Fixes
// ============================================================================

async function applyFixes(client, schema, fixes) {
  console.log(chalk.cyan('\n  Applying fixes...\n'));

  for (const fix of fixes) {
    if (fix.sql && !fix.sql.includes('--')) {
      console.log(chalk.gray(`  → ${fix.description}`));
      try {
        await client.query(fix.sql);
        console.log(chalk.green(`    ✓ Applied successfully`));
      } catch (e) {
        console.log(chalk.red(`    ✗ Failed: ${e.message}`));
      }
    }
  }
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { schema: null, fix: false, detailed: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--schema':
      case '-s':
        options.schema = args[++i];
        break;
      case '--fix':
        options.fix = true;
        break;
      case '--detailed':
      case '-d':
        options.detailed = true;
        break;
      case '--help':
      case '-h':
        console.log(`
KB Quality Audit - Score and optimize any knowledge base

Usage:
  node scripts/kb-quality-audit.js --schema <name> [options]

Options:
  --schema, -s <name>   Schema to audit (required)
  --fix                 Apply recommended fixes automatically
  --detailed, -d        Show detailed breakdown
  --help, -h            Show this help
`);
        process.exit(0);
    }
  }

  return options;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const options = parseArgs();

  if (!options.schema) {
    console.error('Error: --schema is required');
    process.exit(1);
  }

  const client = new pg.Client(CONFIG.db);

  try {
    await client.connect();

    const audit = new KBAudit(client, options.schema);
    const result = await audit.runFullAudit();

    if (options.fix && result.fixes.length > 0) {
      await applyFixes(client, options.schema, result.fixes);
    }

  } catch (e) {
    console.error(chalk.red(`Error: ${e.message}`));
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
