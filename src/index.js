/**
 * RuvNet KB-First Application Builder
 *
 * Build intelligent applications on expert knowledge bases.
 *
 * @module ruvnet-kb-first
 * @version 5.0.0
 */

// Export commands for programmatic use
export { initCommand } from './commands/init.js';
export { scoreCommand } from './commands/score.js';
export { verifyCommand } from './commands/verify.js';
export { hooksCommand } from './commands/hooks.js';
export { statusCommand } from './commands/status.js';
export { phaseCommand } from './commands/phase.js';

// Export MCP server
export { startMCPServer } from './mcp-server.js';

/**
 * KB-First configuration defaults
 */
export const KB_FIRST_DEFAULTS = {
  version: '5.0.0',
  minConfidence: 0.5,
  gapLogging: true,
  phases: 12,
  subphases: 57
};

/**
 * Phase definitions
 */
export const PHASES = [
  { num: 0, name: 'Assessment', subphases: 5 },
  { num: 1, name: 'KB Design', subphases: 5 },
  { num: 1.5, name: 'Hooks Setup', subphases: 4 },
  { num: 2, name: 'Schema Definition', subphases: 4 },
  { num: 3, name: 'KB Population', subphases: 5 },
  { num: 4, name: 'Scoring & Gaps', subphases: 5 },
  { num: 5, name: 'Integration', subphases: 4 },
  { num: 6, name: 'Testing', subphases: 5 },
  { num: 7, name: 'Optimization', subphases: 4 },
  { num: 8, name: 'Verification', subphases: 8 },
  { num: 9, name: 'Security', subphases: 6 },
  { num: 10, name: 'Documentation', subphases: 6 },
  { num: 11, name: 'Deployment', subphases: 6 }
];

/**
 * Calculate total subphases
 */
export function getTotalSubphases() {
  return PHASES.reduce((sum, p) => sum + p.subphases, 0);
}
