/**
 * KB-First Phase Command
 *
 * Runs or shows information about a specific build phase.
 */

import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';

const PHASES = {
  0: {
    name: 'Assessment',
    description: 'Evaluate if KB-First is appropriate for your project',
    subphases: [
      '0.1 Project Analysis',
      '0.2 Domain Complexity',
      '0.3 KB-First Suitability',
      '0.4 Resource Estimation',
      '0.5 Go/No-Go Decision'
    ],
    gate: 'Decision documented and approved'
  },
  1: {
    name: 'KB Design',
    description: 'Design the knowledge base structure',
    subphases: [
      '1.1 Domain Mapping',
      '1.2 Taxonomy Design',
      '1.3 Relationship Model',
      '1.4 Query Patterns',
      '1.5 Design Review'
    ],
    gate: 'KB schema designed and documented'
  },
  1.5: {
    name: 'Hooks Setup',
    description: 'Install and configure KB-First enforcement hooks',
    subphases: [
      '1.5.1 Hook Installation',
      '1.5.2 Hook Configuration',
      '1.5.3 Pattern Training',
      '1.5.4 Hook Verification'
    ],
    gate: 'All hooks passing verification',
    script: '1.5-hooks-verify.sh'
  },
  2: {
    name: 'Schema Definition',
    description: 'Define the database schema for KB storage',
    subphases: [
      '2.1 Table Design',
      '2.2 Vector Columns',
      '2.3 Index Strategy',
      '2.4 Migration Scripts'
    ],
    gate: 'Schema created and migrations applied'
  },
  3: {
    name: 'KB Population',
    description: 'Populate the knowledge base with content',
    subphases: [
      '3.1 Content Collection',
      '3.2 Content Processing',
      '3.3 Embedding Generation',
      '3.4 Import Validation',
      '3.5 Initial Testing'
    ],
    gate: 'KB populated with initial content'
  },
  4: {
    name: 'Scoring & Gaps',
    description: 'Score KB quality and identify gaps',
    subphases: [
      '4.1 Coverage Analysis',
      '4.2 Quality Scoring',
      '4.3 Gap Identification',
      '4.4 Priority Ranking',
      '4.5 Remediation Plan'
    ],
    gate: 'KB score >= 80, gaps documented'
  },
  5: {
    name: 'Integration',
    description: 'Integrate KB into application code',
    subphases: [
      '5.1 Search API',
      '5.2 Code Generation',
      '5.3 Citation System',
      '5.4 Gap Logging'
    ],
    gate: 'KB integrated and accessible'
  },
  6: {
    name: 'Testing',
    description: 'Test KB functionality and accuracy',
    subphases: [
      '6.1 Unit Tests',
      '6.2 Integration Tests',
      '6.3 Accuracy Tests',
      '6.4 Performance Tests',
      '6.5 Edge Cases'
    ],
    gate: 'All tests passing'
  },
  7: {
    name: 'Optimization',
    description: 'Optimize KB performance',
    subphases: [
      '7.1 Query Optimization',
      '7.2 Index Tuning',
      '7.3 Caching Strategy',
      '7.4 Benchmark Validation'
    ],
    gate: 'Performance targets met'
  },
  8: {
    name: 'Verification',
    description: 'Comprehensive KB-First verification',
    subphases: [
      '8.1 Code Scan',
      '8.2 Import Check',
      '8.3 Source Returns',
      '8.4 Startup Verify',
      '8.5 Fallback Check',
      '8.6 Attribution',
      '8.7 Confidence',
      '8.8 Gap Logging'
    ],
    gate: 'All 8 verification scripts pass',
    scripts: [
      '8.1-code-scan.sh',
      '8.2-import-check.sh',
      '8.3-source-returns.sh',
      '8.4-startup-verify.sh',
      '8.5-fallback-check.sh',
      '8.6-attribution.sh',
      '8.7-confidence.sh',
      '8.8-gap-logging.sh'
    ]
  },
  9: {
    name: 'Security',
    description: 'Security audit and hardening',
    subphases: [
      '9.1 Dependency Audit',
      '9.2 OWASP Top 10',
      '9.3 SQL Injection',
      '9.4 Authentication',
      '9.5 Secrets Management',
      '9.6 API Security'
    ],
    gate: 'Security audit passed',
    script: '9-security-audit.sh'
  },
  10: {
    name: 'Documentation',
    description: 'Complete project documentation',
    subphases: [
      '10.1 README',
      '10.2 API Documentation',
      '10.3 KB Schema Docs',
      '10.4 Architecture Docs',
      '10.5 Operator Guide',
      '10.6 Versioning'
    ],
    gate: 'All documentation complete'
  },
  11: {
    name: 'Deployment',
    description: 'Deploy to production',
    subphases: [
      '11.1 Infrastructure',
      '11.2 Environment Config',
      '11.3 CI/CD Pipeline',
      '11.4 Database Migration',
      '11.5 Monitoring',
      '11.6 Go-Live'
    ],
    gate: 'Application deployed and accessible'
  }
};

export async function phaseCommand(phaseNum, options) {
  const cwd = process.cwd();

  // Parse phase number
  const phase = parseFloat(phaseNum);
  const phaseInfo = PHASES[phase];

  if (!phaseInfo) {
    console.log(chalk.red(`Unknown phase: ${phaseNum}`));
    console.log(chalk.gray('Valid phases: 0, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11'));
    return;
  }

  console.log('');
  console.log(chalk.cyan('╔═══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold.white(`  Phase ${phase}: ${phaseInfo.name}`.padEnd(62)) + chalk.cyan('║'));
  console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.gray(`  ${phaseInfo.description}`));
  console.log('');

  // Show subphases
  console.log(chalk.white('  Sub-phases:'));
  for (const sub of phaseInfo.subphases) {
    console.log(chalk.gray(`    • ${sub}`));
  }
  console.log('');

  // Show quality gate
  console.log(chalk.white('  Quality Gate:'));
  console.log(chalk.yellow(`    ${phaseInfo.gate}`));
  console.log('');

  // Run specific sub-phase if specified
  if (options.sub) {
    await runSubphase(cwd, phase, options.sub);
    return;
  }

  // Run verification scripts if available
  if (phaseInfo.scripts || phaseInfo.script) {
    const scripts = phaseInfo.scripts || [phaseInfo.script];
    console.log(chalk.white('  Running verification scripts...'));
    console.log('');

    await runPhaseScripts(cwd, scripts, options.skipGate);
  } else {
    // Show phase documentation
    const phaseDocPath = join(cwd, 'phases', `${String(phase).replace('.', '')}-${phaseInfo.name.toLowerCase().replace(/\s+/g, '-')}.md`);
    const altPhaseDocPath = join(cwd, 'phases', `0${String(phase).replace('.', '')}-${phaseInfo.name.toLowerCase().replace(/\s+/g, '-')}.md`);

    if (existsSync(phaseDocPath)) {
      console.log(chalk.gray(`  Documentation: phases/${phaseDocPath.split('/').pop()}`));
    } else if (existsSync(altPhaseDocPath)) {
      console.log(chalk.gray(`  Documentation: phases/${altPhaseDocPath.split('/').pop()}`));
    }

    console.log('');
    console.log(chalk.white('  Manual Phase'));
    console.log(chalk.gray('  This phase requires manual completion. Review the documentation'));
    console.log(chalk.gray('  and complete all sub-phases before marking as complete.'));
    console.log('');
    console.log(chalk.cyan('  Mark complete: kb-first phase ' + phase + ' --complete'));
  }

  // Show next step
  console.log('');
  console.log(chalk.gray('─────────────────────────────────────────────────────────────────'));
  const nextPhase = getNextPhase(phase);
  if (nextPhase !== null) {
    console.log(chalk.gray(`  Next: kb-first phase ${nextPhase}`));
  } else {
    console.log(chalk.green('  This is the final phase!'));
  }
}

async function runPhaseScripts(cwd, scripts, skipGate) {
  const scriptsDir = join(cwd, 'scripts');
  let passed = 0;
  let failed = 0;

  for (const script of scripts) {
    const scriptPath = join(scriptsDir, script);

    if (!existsSync(scriptPath)) {
      console.log(chalk.yellow(`    Skip: ${script} (not found)`));
      continue;
    }

    const spinner = ora(`  Running ${script}...`).start();

    try {
      chmodSync(scriptPath, 0o755);
      execFileSync('/bin/bash', [scriptPath], {
        cwd,
        stdio: 'pipe',
        timeout: 120000,
        encoding: 'utf-8'
      });

      spinner.succeed(`  ${script}`);
      passed++;
    } catch (error) {
      spinner.fail(`  ${script}`);
      failed++;
    }
  }

  console.log('');

  if (failed === 0) {
    console.log(chalk.green('  ✅ All verification scripts passed'));

    // Update phase in config
    await markPhaseComplete(cwd);
  } else {
    console.log(chalk.red(`  ❌ ${failed} script(s) failed`));

    if (!skipGate) {
      console.log(chalk.yellow('  Quality gate NOT passed. Fix failures before proceeding.'));
    } else {
      console.log(chalk.yellow('  Warning: --skip-gate used. Proceeding despite failures.'));
    }
  }
}

async function runSubphase(cwd, phase, subNum) {
  const phaseInfo = PHASES[phase];
  const subIndex = parseInt(subNum) - 1;

  if (subIndex < 0 || subIndex >= phaseInfo.subphases.length) {
    console.log(chalk.red(`Invalid sub-phase: ${subNum}`));
    console.log(chalk.gray(`Valid sub-phases: 1-${phaseInfo.subphases.length}`));
    return;
  }

  const subphase = phaseInfo.subphases[subIndex];
  console.log(chalk.white(`Running: ${subphase}`));
  console.log('');

  // Check for specific script
  const scripts = phaseInfo.scripts || (phaseInfo.script ? [phaseInfo.script] : []);
  const matchingScript = scripts.find(s => s.startsWith(`${phase}.${subNum}`));

  if (matchingScript) {
    await runPhaseScripts(cwd, [matchingScript], false);
  } else {
    console.log(chalk.gray('  No automated script for this sub-phase.'));
    console.log(chalk.gray('  Complete manually and proceed to next sub-phase.'));
  }
}

async function markPhaseComplete(cwd) {
  const configPath = join(cwd, '.ruvector', 'config.json');

  if (!existsSync(configPath)) return;

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const currentPhase = config.phases?.current || 0;

  if (!config.phases) {
    config.phases = { current: 0, completed: [] };
  }

  if (!config.phases.completed.includes(currentPhase)) {
    config.phases.completed.push(currentPhase);
  }

  // Move to next phase
  const nextPhase = getNextPhase(currentPhase);
  if (nextPhase !== null) {
    config.phases.current = nextPhase;
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getNextPhase(current) {
  const phases = [0, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const currentIndex = phases.indexOf(current);

  if (currentIndex === -1 || currentIndex === phases.length - 1) {
    return null;
  }

  return phases[currentIndex + 1];
}
