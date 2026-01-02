/**
 * WASM KB Test Suite
 *
 * Tests the embedded knowledge base functionality.
 * Run with: npm test
 */

import { jest, describe, it, expect, beforeAll } from '@jest/globals';
import { loadKB, search, checkForUpdates, getStats, KB_VERSION } from '../kb-data/kb-loader.js';

// Increase timeout for WASM loading
jest.setTimeout(60000);

describe('WASM KB Loader', () => {

  describe('KB_VERSION', () => {
    it('should have valid version metadata', () => {
      expect(KB_VERSION).toBeDefined();
      expect(KB_VERSION.hash).toMatch(/^[a-f0-9]{16}$/);
      expect(KB_VERSION.totalEntries).toBeGreaterThan(0);
      expect(KB_VERSION.embeddingDim).toBe(384);
      expect(KB_VERSION.quantization).toBe('binary');
    });

    it('should have a valid export timestamp', () => {
      const date = new Date(KB_VERSION.exportedAt);
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).not.toBeNaN();
    });
  });

  describe('loadKB()', () => {
    let kbResult;

    beforeAll(async () => {
      kbResult = await loadKB();
    });

    it('should load the KB successfully', () => {
      expect(kbResult).toBeDefined();
      expect(kbResult.db).toBeDefined();
      expect(kbResult.embedder).toBeDefined();
      expect(kbResult.entries).toBeDefined();
    });

    it('should load the expected number of entries', () => {
      expect(kbResult.entries.length).toBeGreaterThan(15000);
    });

    it('should have valid entry structure', () => {
      const entry = kbResult.entries[0];
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('title');
      expect(entry).toHaveProperty('content');
      expect(entry).toHaveProperty('category');
    });

    it('should return same instance on subsequent calls', async () => {
      const result2 = await loadKB();
      expect(result2.db).toBe(kbResult.db);
      expect(result2.embedder).toBe(kbResult.embedder);
    });
  });

  describe('search()', () => {
    beforeAll(async () => {
      await loadKB();
    });

    it('should return results for valid queries', async () => {
      const results = await search('how to create agents', 5);
      expect(results).toBeDefined();
      expect(results.results).toBeInstanceOf(Array);
      expect(results.results.length).toBe(5);
    });

    it('should include timing information', async () => {
      const results = await search('vector database', 3);
      expect(results.searchTimeMs).toBeDefined();
      expect(results.searchTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include total entries count', async () => {
      const results = await search('test query', 1);
      expect(results.totalEntries).toBeGreaterThan(15000);
    });

    it('should have valid result structure', async () => {
      const results = await search('swarm topology', 3);
      const result = results.results[0];

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('distance');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('category');
    });

    it('should have scores between 0 and 1', async () => {
      const results = await search('MCP server', 10);
      for (const result of results.results) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    });

    it('should complete in under 100ms', async () => {
      const results = await search('neural network training', 5);
      expect(results.searchTimeMs).toBeLessThan(100);
    });

    it('should handle empty queries gracefully', async () => {
      const results = await search('', 5);
      expect(results.results).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      const results3 = await search('test', 3);
      const results10 = await search('test', 10);

      expect(results3.results.length).toBe(3);
      expect(results10.results.length).toBe(10);
    });
  });

  describe('getStats()', () => {
    beforeAll(async () => {
      await loadKB();
    });

    it('should return valid stats', () => {
      const stats = getStats();
      expect(stats).toBeDefined();
      expect(stats.version).toBeDefined();
      expect(stats.loaded).toBe(true);
      expect(stats.entries).toBeGreaterThan(15000);
    });

    it('should show KB is loaded', () => {
      const stats = getStats();
      expect(stats.loaded).toBe(true);
    });
  });

  describe('checkForUpdates()', () => {
    it('should return update status', async () => {
      const status = await checkForUpdates();
      expect(status).toBeDefined();
      expect(status.embeddedHash).toBeDefined();
      expect(status.message).toBeDefined();
    });

    it('should have valid hash format', async () => {
      const status = await checkForUpdates();
      expect(status.embeddedHash).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should handle missing PostgreSQL gracefully', async () => {
      // Use invalid config to simulate missing DB
      const status = await checkForUpdates({
        host: 'nonexistent-host',
        port: 9999,
        database: 'test',
        user: 'test',
        password: 'test',
      });

      expect(status.currentHash).toBe('unavailable');
      expect(status.needsUpdate).toBe(false);
    });
  });

  describe('Performance', () => {
    beforeAll(async () => {
      await loadKB();
    });

    it('should complete 100 searches in under 2 seconds', async () => {
      const start = Date.now();
      const queries = [
        'agent creation', 'swarm patterns', 'vector search',
        'MCP tools', 'neural network', 'deployment', 'memory',
        'performance', 'security', 'configuration'
      ];

      for (let i = 0; i < 10; i++) {
        for (const query of queries) {
          await search(query, 5);
        }
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(2000);
    });
  });
});
