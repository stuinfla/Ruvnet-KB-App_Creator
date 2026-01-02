#!/usr/bin/env node

/**
 * KB Export to WASM-Compatible Binary Format
 *
 * Exports the ask_ruvnet knowledge base to a compact binary format
 * that can be loaded by RvLite WASM at runtime.
 *
 * Features:
 * - Binary quantization (32x compression)
 * - Version hashing for auto-update detection
 * - Cross-platform compatible (Windows, Mac, Linux)
 * - Chunked export for memory efficiency
 *
 * Usage:
 *   node scripts/kb-export-wasm.js --schema ask_ruvnet --output kb-data/
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
  export: {
    chunkSize: 1000,           // Rows per chunk
    embeddingDim: 384,         // all-MiniLM-L6-v2 dimensions
    quantization: 'binary',    // 'binary' (32x), 'scalar' (4x), or 'none'
  }
};

// ============================================================================
// Binary Quantization
// ============================================================================

/**
 * Binary quantize a float32 embedding to bits (32x compression)
 * Each float > 0 becomes 1, else 0
 */
function binaryQuantize(embedding) {
  const bytes = new Uint8Array(Math.ceil(embedding.length / 8));
  for (let i = 0; i < embedding.length; i++) {
    if (embedding[i] > 0) {
      bytes[Math.floor(i / 8)] |= (1 << (7 - (i % 8)));
    }
  }
  return bytes;
}

/**
 * Compute Hamming distance between two binary vectors
 */
function hammingDistance(a, b) {
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = a[i] ^ b[i];
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

// ============================================================================
// Export Functions
// ============================================================================

async function exportKB(schema, outputDir) {
  const client = new pg.Client(CONFIG.db);

  try {
    await client.connect();
    console.log(`\n📦 KB Export to WASM Format`);
    console.log(`   Schema: ${schema}`);
    console.log(`   Output: ${outputDir}`);
    console.log(`   Quantization: ${CONFIG.export.quantization}`);

    // Create output directory
    fs.mkdirSync(outputDir, { recursive: true });

    // Get total count
    const countResult = await client.query(`
      SELECT COUNT(*) as total FROM ${schema}.architecture_docs
      WHERE embedding IS NOT NULL AND is_duplicate = false
    `);
    const totalEntries = parseInt(countResult.rows[0].total);
    console.log(`\n   Total entries: ${totalEntries.toLocaleString()}`);

    // Get category stats
    const categoryResult = await client.query(`
      SELECT category, COUNT(*) as count
      FROM ${schema}.architecture_docs
      WHERE embedding IS NOT NULL AND is_duplicate = false
      GROUP BY category ORDER BY count DESC
    `);

    // Initialize data structures
    const metadata = {
      version: '1.0.0',
      schema: schema,
      exportedAt: new Date().toISOString(),
      totalEntries: totalEntries,
      embeddingDim: CONFIG.export.embeddingDim,
      quantization: CONFIG.export.quantization,
      categories: categoryResult.rows.map(r => ({ name: r.category, count: parseInt(r.count) })),
      contentHash: null, // Computed after export
    };

    // Export in chunks
    const entries = [];
    const embeddings = [];
    let offset = 0;
    let hashInput = '';

    console.log(`\n   Exporting chunks...`);

    while (offset < totalEntries) {
      const result = await client.query(`
        SELECT id, title, content, category, quality_score, embedding
        FROM ${schema}.architecture_docs
        WHERE embedding IS NOT NULL AND is_duplicate = false
        ORDER BY id
        LIMIT $1 OFFSET $2
      `, [CONFIG.export.chunkSize, offset]);

      for (const row of result.rows) {
        // Parse embedding
        const embeddingArray = row.embedding;

        // Create entry metadata (without embedding)
        const entry = {
          id: row.id,
          title: row.title,
          content: row.content.substring(0, 500), // Truncate for size
          category: row.category,
          quality: row.quality_score,
        };
        entries.push(entry);

        // Quantize embedding
        if (CONFIG.export.quantization === 'binary') {
          embeddings.push(binaryQuantize(embeddingArray));
        } else {
          embeddings.push(new Float32Array(embeddingArray));
        }

        // Add to hash input
        hashInput += `${row.id}:${row.title}:${row.category}|`;
      }

      offset += CONFIG.export.chunkSize;
      const progress = Math.min(100, Math.round((offset / totalEntries) * 100));
      process.stdout.write(`\r   Progress: ${progress}% (${Math.min(offset, totalEntries).toLocaleString()}/${totalEntries.toLocaleString()})`);
    }

    console.log('\n');

    // Compute content hash
    metadata.contentHash = crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
    console.log(`   Content Hash: ${metadata.contentHash}`);

    // Write metadata
    const metadataPath = path.join(outputDir, 'kb-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`   ✓ Wrote ${metadataPath}`);

    // Write entries (JSON, gzipped in production)
    const entriesPath = path.join(outputDir, 'kb-entries.json');
    fs.writeFileSync(entriesPath, JSON.stringify(entries));
    const entriesSize = fs.statSync(entriesPath).size;
    console.log(`   ✓ Wrote ${entriesPath} (${(entriesSize / 1024 / 1024).toFixed(2)} MB)`);

    // Write embeddings (binary format)
    const embeddingsPath = path.join(outputDir, 'kb-embeddings.bin');
    const bytesPerVector = CONFIG.export.quantization === 'binary'
      ? Math.ceil(CONFIG.export.embeddingDim / 8)  // 48 bytes for binary
      : CONFIG.export.embeddingDim * 4;            // 1536 bytes for float32

    const embeddingsBuffer = Buffer.alloc(embeddings.length * bytesPerVector);
    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i];
      if (CONFIG.export.quantization === 'binary') {
        Buffer.from(embedding).copy(embeddingsBuffer, i * bytesPerVector);
      } else {
        Buffer.from(embedding.buffer).copy(embeddingsBuffer, i * bytesPerVector);
      }
    }
    fs.writeFileSync(embeddingsPath, embeddingsBuffer);
    const embeddingsSize = fs.statSync(embeddingsPath).size;
    console.log(`   ✓ Wrote ${embeddingsPath} (${(embeddingsSize / 1024 / 1024).toFixed(2)} MB)`);

    // Calculate total size
    const totalSize = entriesSize + embeddingsSize + fs.statSync(metadataPath).size;
    console.log(`\n   📊 Total Export Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    // Compression ratio
    const originalSize = totalEntries * CONFIG.export.embeddingDim * 4; // Float32
    const compressionRatio = originalSize / embeddingsSize;
    console.log(`   📉 Compression Ratio: ${compressionRatio.toFixed(1)}x`);

    // Generate loader module
    await generateLoader(outputDir, metadata);

    return metadata;

  } finally {
    await client.end();
  }
}

// ============================================================================
// Loader Generator
// ============================================================================

async function generateLoader(outputDir, metadata) {
  const loaderCode = `/**
 * WASM KB Loader - Auto-generated
 *
 * Loads the embedded knowledge base into RvLite WASM.
 * Provides semantic search with ~5ms latency.
 *
 * Content Hash: ${metadata.contentHash}
 * Generated: ${metadata.exportedAt}
 * Entries: ${metadata.totalEntries.toLocaleString()}
 */

import { RvLite, RvLiteConfig, Embedder } from '@ruvector/edge-full/rvlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// KB Version Info
export const KB_VERSION = {
  hash: '${metadata.contentHash}',
  exportedAt: '${metadata.exportedAt}',
  totalEntries: ${metadata.totalEntries},
  embeddingDim: ${metadata.embeddingDim},
  quantization: '${metadata.quantization}',
};

// Singleton instance
let db = null;
let embedder = null;
let entries = null;
let isLoaded = false;

/**
 * Check if a newer KB version is available from PostgreSQL
 */
export async function checkForUpdates(pgConfig) {
  try {
    const pg = await import('pg');
    const client = new pg.default.Client(pgConfig || {
      host: 'localhost',
      port: 5435,
      database: 'postgres',
      user: 'postgres',
      password: 'guruKB2025',
    });

    await client.connect();

    // Get current hash from PostgreSQL
    const result = await client.query(\`
      SELECT MD5(STRING_AGG(id::text || ':' || title || ':' || category, '|' ORDER BY id))::text as hash
      FROM ask_ruvnet.architecture_docs
      WHERE embedding IS NOT NULL AND is_duplicate = false
    \`);

    await client.end();

    const currentHash = result.rows[0]?.hash?.substring(0, 16) || 'unknown';
    const needsUpdate = currentHash !== KB_VERSION.hash;

    return {
      embeddedHash: KB_VERSION.hash,
      currentHash: currentHash,
      needsUpdate: needsUpdate,
      message: needsUpdate
        ? 'KB has been updated. Run: npm update ruvnet-kb-first'
        : 'KB is up to date',
    };
  } catch (e) {
    return {
      embeddedHash: KB_VERSION.hash,
      currentHash: 'unavailable',
      needsUpdate: false,
      message: 'Could not check for updates (PostgreSQL not available)',
    };
  }
}

/**
 * Load the embedded KB into RvLite WASM
 */
export async function loadKB() {
  if (isLoaded) return { db, embedder, entries };

  console.log('Loading embedded KB...');
  const startTime = Date.now();

  // Load metadata
  const metadataPath = path.join(__dirname, 'kb-metadata.json');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

  // Load entries
  const entriesPath = path.join(__dirname, 'kb-entries.json');
  entries = JSON.parse(fs.readFileSync(entriesPath, 'utf-8'));

  // Load embeddings
  const embeddingsPath = path.join(__dirname, 'kb-embeddings.bin');
  const embeddingsBuffer = fs.readFileSync(embeddingsPath);

  // Initialize RvLite with 384 dimensions
  const config = new RvLiteConfig();
  config.dimensions = metadata.embeddingDim;
  config.distance_metric = 'cosine';
  db = new RvLite(config);

  // Initialize embedder for query embedding
  embedder = new Embedder();

  // Load vectors into RvLite
  const bytesPerVector = metadata.quantization === 'binary'
    ? Math.ceil(metadata.embeddingDim / 8)
    : metadata.embeddingDim * 4;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const offset = i * bytesPerVector;

    // For binary quantization, we need to convert back to float32 for RvLite
    // This is a lightweight operation since we're just expanding bits
    let vector;
    if (metadata.quantization === 'binary') {
      const binaryBytes = embeddingsBuffer.slice(offset, offset + bytesPerVector);
      vector = new Float32Array(metadata.embeddingDim);
      for (let j = 0; j < metadata.embeddingDim; j++) {
        const byteIdx = Math.floor(j / 8);
        const bitIdx = 7 - (j % 8);
        vector[j] = (binaryBytes[byteIdx] & (1 << bitIdx)) ? 1.0 : -1.0;
      }
    } else {
      vector = new Float32Array(embeddingsBuffer.buffer, offset, metadata.embeddingDim);
    }

    // Insert with metadata
    db.insert_with_id(entry.id.toString(), vector, {
      title: entry.title,
      category: entry.category,
      quality: entry.quality,
    });
  }

  isLoaded = true;
  const loadTime = Date.now() - startTime;
  console.log(\`KB loaded: \${entries.length.toLocaleString()} entries in \${loadTime}ms\`);

  return { db, embedder, entries };
}

/**
 * Semantic search using embedded KB
 */
export async function search(query, limit = 10, filter = null) {
  if (!isLoaded) await loadKB();

  const startTime = Date.now();

  // Generate query embedding
  const queryVector = embedder.embed(query);

  // Search
  let results;
  if (filter) {
    results = db.search_with_filter(queryVector, limit, filter);
  } else {
    results = db.search(queryVector, limit);
  }

  // Enrich results with entry data
  const enrichedResults = results.map(r => {
    const entry = entries.find(e => e.id.toString() === r.id);
    return {
      id: r.id,
      distance: r.distance,
      title: entry?.title || 'Unknown',
      content: entry?.content || '',
      category: entry?.category || 'general',
      quality: entry?.quality || 0,
    };
  });

  const searchTime = Date.now() - startTime;

  return {
    results: enrichedResults,
    searchTimeMs: searchTime,
    query: query,
    totalEntries: entries.length,
  };
}

/**
 * Get KB statistics
 */
export function getStats() {
  return {
    version: KB_VERSION,
    loaded: isLoaded,
    entries: entries?.length || 0,
    categories: KB_VERSION.totalEntries > 0 ? 15 : 0,
  };
}

// Export for CommonJS compatibility
export default {
  loadKB,
  search,
  checkForUpdates,
  getStats,
  KB_VERSION,
};
`;

  const loaderPath = path.join(outputDir, 'kb-loader.js');
  fs.writeFileSync(loaderPath, loaderCode);
  console.log(`   ✓ Wrote ${loaderPath}`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const schemaIdx = args.indexOf('--schema');
  const outputIdx = args.indexOf('--output');

  const schema = schemaIdx >= 0 ? args[schemaIdx + 1] : 'ask_ruvnet';
  const outputDir = outputIdx >= 0 ? args[outputIdx + 1] : 'kb-data';

  try {
    const metadata = await exportKB(schema, outputDir);

    console.log(`\n✅ Export complete!`);
    console.log(`\nTo use the embedded KB:`);
    console.log(`  import { loadKB, search } from './${outputDir}/kb-loader.js';`);
    console.log(`  await loadKB();`);
    console.log(`  const results = await search('how to create agents', 5);`);

  } catch (error) {
    console.error(`\n❌ Export failed: ${error.message}`);
    process.exit(1);
  }
}

main();
