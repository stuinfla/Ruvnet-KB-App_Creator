/**
 * WASM KB Loader - Auto-generated
 *
 * Loads the embedded knowledge base into RvLite WASM.
 * Provides semantic search with ~5ms latency.
 *
 * Content Hash: 67818fd61d6327c3
 * Generated: 2026-01-02T18:29:18.233Z
 * Entries: 16,575
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Initialize WASM on first import
let wasmInitialized = false;
let RvLite, Embedder;

async function ensureWasmInit() {
  if (!wasmInitialized) {
    // Dynamic import to get the init function
    const rvliteModule = await import('@ruvector/edge-full/rvlite');

    // Get the wasm file path
    const rvlitePath = path.dirname(fileURLToPath(import.meta.resolve('@ruvector/edge-full/rvlite')));
    const wasmPath = path.join(rvlitePath, 'rvlite_bg.wasm');

    // Read the wasm file and pass as buffer (Node.js compatible)
    const wasmBuffer = fs.readFileSync(wasmPath);

    // Initialize with the buffer
    await rvliteModule.default(wasmBuffer);

    // Get exports
    RvLite = rvliteModule.RvLite;
    Embedder = rvliteModule.Embedder;

    wasmInitialized = true;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// KB Version Info
export const KB_VERSION = {
  hash: '67818fd61d6327c3',
  exportedAt: '2026-01-02T18:29:18.233Z',
  totalEntries: 16575,
  embeddingDim: 384,
  quantization: 'binary',
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
    const result = await client.query(`
      SELECT MD5(STRING_AGG(id::text || ':' || title || ':' || category, '|' ORDER BY id))::text as hash
      FROM ask_ruvnet.architecture_docs
      WHERE embedding IS NOT NULL AND is_duplicate = false
    `);

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

  // Initialize WASM first
  await ensureWasmInit();

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

  // Initialize RvLite with default config (384 dimensions, cosine)
  db = RvLite.default();

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
  console.log(`KB loaded: ${entries.length.toLocaleString()} entries in ${loadTime}ms`);

  return { db, embedder, entries };
}

/**
 * Semantic search using embedded KB
 */
export async function search(query, limit = 10, filter = null) {
  await ensureWasmInit();
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
    const entry = entries.find(e => e.id.toString() === r.id.toString());
    return {
      id: r.id,
      score: r.score,
      distance: 1 - r.score, // Convert similarity score to distance
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
