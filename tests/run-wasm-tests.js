#!/usr/bin/env node
/**
 * WASM KB Test Runner
 *
 * Runs comprehensive tests on the embedded KB.
 * Usage: node tests/run-wasm-tests.js
 */

import { loadKB, search, checkForUpdates, getStats, KB_VERSION } from '../kb-data/kb-loader.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('WASM KB Test Suite');
  console.log('='.repeat(60));

  // ==========================================
  console.log('\n[1] KB_VERSION Tests');
  // ==========================================

  assert(KB_VERSION !== undefined, 'KB_VERSION is defined');
  assert(/^[a-f0-9]{16}$/.test(KB_VERSION.hash), 'Hash is valid 16-char hex');
  assert(KB_VERSION.totalEntries > 15000, 'Has > 15,000 entries');
  assert(KB_VERSION.embeddingDim === 384, 'Embedding dim is 384');
  assert(KB_VERSION.quantization === 'binary', 'Quantization is binary');

  const date = new Date(KB_VERSION.exportedAt);
  assert(!isNaN(date.getTime()), 'Export timestamp is valid');

  // ==========================================
  console.log('\n[2] loadKB() Tests');
  // ==========================================

  const loadStart = Date.now();
  const kbResult = await loadKB();
  const loadTime = Date.now() - loadStart;

  assert(kbResult !== undefined, 'loadKB returns result');
  assert(kbResult.db !== undefined, 'Result has db');
  assert(kbResult.embedder !== undefined, 'Result has embedder');
  assert(kbResult.entries !== undefined, 'Result has entries');
  assert(kbResult.entries.length > 15000, 'Loaded > 15,000 entries');
  assert(loadTime < 5000, `Load time < 5s (was ${loadTime}ms)`);

  const entry = kbResult.entries[0];
  assert(entry.id !== undefined, 'Entry has id');
  assert(entry.title !== undefined, 'Entry has title');
  assert(entry.content !== undefined, 'Entry has content');
  assert(entry.category !== undefined, 'Entry has category');

  // Singleton test
  const result2 = await loadKB();
  assert(result2.db === kbResult.db, 'Returns same instance');

  // ==========================================
  console.log('\n[3] search() Tests');
  // ==========================================

  const queries = [
    'how to create agents',
    'swarm topology patterns',
    'vector database optimization',
    'MCP server configuration',
    'neural network training'
  ];

  for (const query of queries) {
    const searchStart = Date.now();
    const results = await search(query, 5);
    const searchTime = Date.now() - searchStart;

    assert(results.results.length === 5, `"${query.slice(0, 20)}..." returns 5 results`);
    assert(searchTime < 100, `Search time < 100ms (was ${searchTime}ms)`);
  }

  // Result structure
  const results = await search('test query', 3);
  assert(results.searchTimeMs !== undefined, 'Has searchTimeMs');
  assert(results.totalEntries > 15000, 'Has totalEntries');
  assert(results.query === 'test query', 'Has query');

  const r = results.results[0];
  assert(r.id !== undefined, 'Result has id');
  assert(r.score >= 0 && r.score <= 1, 'Score is 0-1');
  assert(r.title !== undefined, 'Result has title');

  // Limit test
  const r3 = await search('test', 3);
  const r10 = await search('test', 10);
  assert(r3.results.length === 3, 'Limit 3 returns 3');
  assert(r10.results.length === 10, 'Limit 10 returns 10');

  // ==========================================
  console.log('\n[4] getStats() Tests');
  // ==========================================

  const stats = getStats();
  assert(stats.version !== undefined, 'Stats has version');
  assert(stats.loaded === true, 'KB is loaded');
  assert(stats.entries > 15000, 'Has > 15,000 entries');

  // ==========================================
  console.log('\n[5] checkForUpdates() Tests');
  // ==========================================

  const updateStatus = await checkForUpdates();
  assert(updateStatus.embeddedHash !== undefined, 'Has embeddedHash');
  assert(updateStatus.message !== undefined, 'Has message');
  assert(/^[a-f0-9]{16}$/.test(updateStatus.embeddedHash), 'Embedded hash is valid');

  // Invalid config test
  const invalidStatus = await checkForUpdates({
    host: 'nonexistent',
    port: 9999,
    database: 'test',
    user: 'test',
    password: 'test'
  });
  assert(invalidStatus.currentHash === 'unavailable', 'Handles missing DB gracefully');

  // ==========================================
  console.log('\n[6] Performance Tests');
  // ==========================================

  const perfStart = Date.now();
  const perfQueries = ['agent', 'swarm', 'vector', 'MCP', 'neural', 'deploy', 'memory', 'perf', 'security', 'config'];

  for (let i = 0; i < 10; i++) {
    for (const q of perfQueries) {
      await search(q, 5);
    }
  }

  const perfTime = Date.now() - perfStart;
  assert(perfTime < 3000, `100 searches in < 3s (was ${perfTime}ms)`);

  // ==========================================
  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n❌ TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
