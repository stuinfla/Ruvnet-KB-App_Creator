#!/usr/bin/env node

/**
 * KB Ingest Template - Optimized Knowledge Base Ingestion
 *
 * Usage:
 *   node scripts/kb-ingest-template.js --source ./docs --schema my_project
 *   node scripts/kb-ingest-template.js --source ./content --schema ask_ruvnet --update
 *
 * What it does:
 *   1. Hash     - SHA-256 of normalized content
 *   2. Dedupe   - Skip if hash exists (or update if higher quality)
 *   3. Categorize - Auto-detect from 15 category rules
 *   4. Score    - Calculate quality 0-100
 *   5. Embed    - PostgreSQL ruvector_embed() (Rust, not WASM)
 *   6. View     - Auto-creates {schema}.kb optimized view
 */

import { createHash } from 'crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, basename, relative } from 'path';
import pg from 'pg';

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
  supportedExtensions: ['.md', '.txt', '.json', '.yaml', '.yml', '.ts', '.js', '.py', '.sql'],
  minContentLength: 100,
  maxContentLength: 50000,
};

// ============================================================================
// 15 Category Rules
// ============================================================================

const CATEGORY_RULES = [
  // Agents & Orchestration
  { category: 'agents', patterns: [/agent/i, /swarm/i, /orchestrat/i, /coordinator/i, /spawn/i] },
  { category: 'workflows', patterns: [/workflow/i, /pipeline/i, /dag\b/i, /task.?flow/i] },

  // AI/ML
  { category: 'embeddings', patterns: [/embed/i, /vector/i, /semantic/i, /onnx/i, /transformer/i] },
  { category: 'neural', patterns: [/neural/i, /gnn\b/i, /attention/i, /sona\b/i, /lora\b/i] },
  { category: 'inference', patterns: [/inference/i, /predict/i, /model\b/i, /llm\b/i, /prompt/i] },

  // Data & Storage
  { category: 'database', patterns: [/database/i, /postgres/i, /sql\b/i, /schema/i, /migration/i] },
  { category: 'storage', patterns: [/storage/i, /persist/i, /cache/i, /memory/i, /store/i] },

  // Security & Auth
  { category: 'security', patterns: [/security/i, /auth/i, /encrypt/i, /token/i, /credential/i] },
  { category: 'compliance', patterns: [/compliance/i, /audit/i, /gdpr/i, /pci/i, /hipaa/i] },

  // Infrastructure
  { category: 'deployment', patterns: [/deploy/i, /docker/i, /kubernetes/i, /k8s/i, /ci.?cd/i] },
  { category: 'config', patterns: [/config/i, /setting/i, /environment/i, /\.env/i] },

  // Development
  { category: 'api', patterns: [/api\b/i, /endpoint/i, /rest\b/i, /graphql/i, /grpc/i] },
  { category: 'testing', patterns: [/test/i, /spec\b/i, /mock/i, /fixture/i, /assert/i] },
  { category: 'patterns', patterns: [/pattern/i, /best.?practice/i, /architecture/i, /design/i] },

  // Fallback
  { category: 'general', patterns: [/.*/] },
];

// ============================================================================
// Content Hashing
// ============================================================================

function normalizeContent(content) {
  return content
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function hashContent(content) {
  const normalized = normalizeContent(content);
  return createHash('sha256').update(normalized).digest('hex');
}

// ============================================================================
// Auto-Categorization
// ============================================================================

function categorize(title, content, filePath) {
  const searchText = `${title} ${content} ${filePath}`;

  for (const rule of CATEGORY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(searchText)) {
        return rule.category;
      }
    }
  }

  return 'general';
}

// ============================================================================
// Quality Scoring (0-100)
// ============================================================================

function scoreQuality(entry) {
  let score = 50; // Base score

  const content = entry.content || '';
  const title = entry.title || '';

  // Length scoring (10-20 points)
  const length = content.length;
  if (length >= 500 && length <= 5000) score += 15;
  else if (length >= 200 && length <= 10000) score += 10;
  else if (length < 100) score -= 20;

  // Structure scoring (up to 15 points)
  if (content.includes('##') || content.includes('###')) score += 5;
  if (content.includes('```')) score += 5; // Code blocks
  if (content.includes('|') && content.includes('-')) score += 5; // Tables

  // Source attribution (up to 10 points)
  if (entry.source_expert) score += 5;
  if (entry.source_url) score += 5;

  // Title quality (up to 10 points)
  if (title.length >= 10 && title.length <= 100) score += 5;
  if (!title.includes('untitled') && !title.includes('undefined')) score += 5;

  // Content quality indicators (up to 15 points)
  if (/example|implementation|usage/i.test(content)) score += 5;
  if (/best practice|recommended|should/i.test(content)) score += 5;
  if (/warning|caution|avoid|don't/i.test(content)) score += 5;

  // Penalties
  if (/todo|fixme|hack|temporary/i.test(content)) score -= 10;
  if (content.split('\n').length < 3) score -= 10;

  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// File Processing
// ============================================================================

function extractTitleFromContent(content, filePath) {
  // Try to find a markdown title
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();

  // Try first non-empty line
  const firstLine = content.split('\n').find(line => line.trim().length > 0);
  if (firstLine && firstLine.length < 100) {
    return firstLine.replace(/^#+\s*/, '').trim();
  }

  // Fall back to filename
  return basename(filePath, extname(filePath))
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function processFile(filePath, baseDir) {
  const ext = extname(filePath).toLowerCase();
  if (!CONFIG.supportedExtensions.includes(ext)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');

  if (content.length < CONFIG.minContentLength) {
    return null;
  }

  const truncatedContent = content.slice(0, CONFIG.maxContentLength);
  const title = extractTitleFromContent(truncatedContent, filePath);
  const relativePath = relative(baseDir, filePath);

  const entry = {
    title,
    content: truncatedContent,
    source_path: relativePath,
    source_file: basename(filePath),
    content_hash: hashContent(truncatedContent),
    category: null,
    quality_score: null,
    source_expert: null,
    source_url: null,
  };

  entry.category = categorize(title, truncatedContent, relativePath);
  entry.quality_score = scoreQuality(entry);

  return entry;
}

function walkDirectory(dir, baseDir = dir) {
  const entries = [];

  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    // Skip hidden files and node_modules
    if (item.startsWith('.') || item === 'node_modules') continue;

    if (stat.isDirectory()) {
      entries.push(...walkDirectory(fullPath, baseDir));
    } else {
      const entry = processFile(fullPath, baseDir);
      if (entry) {
        entries.push(entry);
      }
    }
  }

  return entries;
}

// ============================================================================
// Database Operations
// ============================================================================

async function ensureSchema(client, schema) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);

  // Create main table
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${schema}.kb_entries (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      content_hash VARCHAR(64) UNIQUE NOT NULL,
      category VARCHAR(50) DEFAULT 'general',
      quality_score INTEGER DEFAULT 50,
      source_path TEXT,
      source_file TEXT,
      source_expert TEXT,
      source_url TEXT,
      embedding real[],
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Create indexes
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_${schema}_kb_category
    ON ${schema}.kb_entries(category)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_${schema}_kb_quality
    ON ${schema}.kb_entries(quality_score DESC)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_${schema}_kb_hash
    ON ${schema}.kb_entries(content_hash)
  `);
}

async function createOptimizedView(client, schema) {
  // Drop and recreate the optimized view
  await client.query(`DROP VIEW IF EXISTS ${schema}.kb`);

  await client.query(`
    CREATE VIEW ${schema}.kb AS
    SELECT
      id,
      title,
      content,
      category,
      quality_score,
      source_expert,
      source_url,
      embedding,
      created_at
    FROM ${schema}.kb_entries
    WHERE quality_score >= 40
    ORDER BY quality_score DESC, created_at DESC
  `);

  console.log(`  ✓ Created optimized view: ${schema}.kb`);
}

async function checkExistingHash(client, schema, contentHash) {
  const result = await client.query(
    `SELECT id, quality_score FROM ${schema}.kb_entries WHERE content_hash = $1`,
    [contentHash]
  );
  return result.rows[0] || null;
}

async function insertEntry(client, schema, entry) {
  const result = await client.query(`
    INSERT INTO ${schema}.kb_entries
    (title, content, content_hash, category, quality_score, source_path, source_file, source_expert, source_url, embedding)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ruvector_embed($2))
    RETURNING id
  `, [
    entry.title,
    entry.content,
    entry.content_hash,
    entry.category,
    entry.quality_score,
    entry.source_path,
    entry.source_file,
    entry.source_expert,
    entry.source_url,
  ]);
  return result.rows[0].id;
}

async function updateEntry(client, schema, id, entry) {
  await client.query(`
    UPDATE ${schema}.kb_entries
    SET title = $1, content = $2, category = $3, quality_score = $4,
        source_path = $5, source_file = $6, embedding = ruvector_embed($2),
        updated_at = NOW()
    WHERE id = $7
  `, [
    entry.title,
    entry.content,
    entry.category,
    entry.quality_score,
    entry.source_path,
    entry.source_file,
    id,
  ]);
}

// ============================================================================
// Main Ingestion Process
// ============================================================================

async function ingest(sourceDir, schema, options = {}) {
  const { update = false, minQuality = 30 } = options;

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║           RuvNet KB Ingest Template v1.0.0                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`  Source:    ${sourceDir}`);
  console.log(`  Schema:    ${schema}`);
  console.log(`  Mode:      ${update ? 'Update (replace higher quality)' : 'Insert (skip duplicates)'}`);
  console.log(`  Min Score: ${minQuality}\n`);

  // Validate source directory
  if (!existsSync(sourceDir)) {
    console.error(`  ✗ Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  // Connect to database
  const client = new pg.Client(CONFIG.db);

  try {
    await client.connect();
    console.log('  ✓ Connected to ruvector-postgres');

    // Ensure schema and table exist
    await ensureSchema(client, schema);
    console.log(`  ✓ Schema ${schema} ready`);

    // Process files
    console.log('\n  Processing files...\n');
    const entries = walkDirectory(sourceDir);

    const stats = {
      total: entries.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      lowQuality: 0,
      duplicates: 0,
    };

    for (const entry of entries) {
      // Skip low quality
      if (entry.quality_score < minQuality) {
        stats.lowQuality++;
        continue;
      }

      // Check for existing hash
      const existing = await checkExistingHash(client, schema, entry.content_hash);

      if (existing) {
        if (update && entry.quality_score > existing.quality_score) {
          // Update with higher quality version
          await updateEntry(client, schema, existing.id, entry);
          stats.updated++;
          console.log(`    ↻ Updated: ${entry.title} (${entry.quality_score} > ${existing.quality_score})`);
        } else {
          stats.duplicates++;
        }
      } else {
        // Insert new entry
        await insertEntry(client, schema, entry);
        stats.inserted++;
        console.log(`    + Inserted: ${entry.title} [${entry.category}] (${entry.quality_score}/100)`);
      }
    }

    // Create optimized view
    await createOptimizedView(client, schema);

    // Get final count
    const countResult = await client.query(`SELECT COUNT(*) FROM ${schema}.kb_entries`);
    const totalEntries = parseInt(countResult.rows[0].count);

    // Print summary
    console.log('\n  ══════════════════════════════════════════════════════════════');
    console.log('  INGESTION COMPLETE');
    console.log('  ══════════════════════════════════════════════════════════════');
    console.log(`    Files Processed:    ${stats.total}`);
    console.log(`    Inserted:           ${stats.inserted}`);
    console.log(`    Updated:            ${stats.updated}`);
    console.log(`    Skipped (dup):      ${stats.duplicates}`);
    console.log(`    Skipped (quality):  ${stats.lowQuality}`);
    console.log(`    Total in KB:        ${totalEntries}`);
    console.log('  ══════════════════════════════════════════════════════════════\n');

    // Category breakdown
    const categoryResult = await client.query(`
      SELECT category, COUNT(*) as count, AVG(quality_score)::int as avg_score
      FROM ${schema}.kb_entries
      GROUP BY category
      ORDER BY count DESC
    `);

    console.log('  Category Breakdown:');
    for (const row of categoryResult.rows) {
      console.log(`    ${row.category.padEnd(15)} ${row.count.toString().padStart(5)} entries (avg score: ${row.avg_score})`);
    }

    console.log('\n  Query examples:');
    console.log(`    SELECT * FROM ${schema}.kb WHERE category = 'agents' LIMIT 5;`);
    console.log(`    SELECT * FROM ${schema}.kb WHERE quality_score >= 80;`);
    console.log(`    SELECT title, embedding <=> ruvector_embed('your query') AS distance`);
    console.log(`      FROM ${schema}.kb_entries ORDER BY distance LIMIT 10;\n`);

  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    source: null,
    schema: null,
    update: false,
    minQuality: 30,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--source':
      case '-s':
        options.source = args[++i];
        break;
      case '--schema':
        options.schema = args[++i];
        break;
      case '--update':
      case '-u':
        options.update = true;
        break;
      case '--min-quality':
        options.minQuality = parseInt(args[++i]);
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
KB Ingest Template - Optimized Knowledge Base Ingestion

Usage:
  node scripts/kb-ingest-template.js --source <dir> --schema <name> [options]

Options:
  --source, -s <dir>    Source directory to ingest
  --schema <name>       PostgreSQL schema name
  --update, -u          Update existing entries if quality is higher
  --min-quality <n>     Minimum quality score (default: 30)
  --help, -h            Show this help

Examples:
  # Ingest documentation
  node scripts/kb-ingest-template.js --source ./docs --schema my_project

  # Update mode (replace if better quality)
  node scripts/kb-ingest-template.js --source ./content --schema ask_ruvnet --update

  # High quality only
  node scripts/kb-ingest-template.js --source ./docs --schema my_kb --min-quality 60

Environment Variables:
  KB_HOST       Database host (default: localhost)
  KB_PORT       Database port (default: 5435)
  KB_PASSWORD   Database password (default: guruKB2025)
`);
}

// ============================================================================
// Entry Point
// ============================================================================

const options = parseArgs();

if (!options.source || !options.schema) {
  console.error('Error: --source and --schema are required');
  printHelp();
  process.exit(1);
}

ingest(options.source, options.schema, {
  update: options.update,
  minQuality: options.minQuality,
}).catch(console.error);
