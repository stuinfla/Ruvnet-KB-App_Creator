/**
 * KB-First Status Command
 *
 * Shows the current status of a KB-First project.
 */

import chalk from 'chalk';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';

const PHASES = [
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

export async function statusCommand(options) {
  const cwd = process.cwd();
  const projectName = cwd.split('/').pop();

  console.log('');
  console.log(chalk.cyan('╔═══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold.white('                 RuvNet-KB-First Project Status                ') + chalk.cyan('║'));
  console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════════╝'));
  console.log('');

  // Check if initialized
  const configPath = join(cwd, '.ruvector', 'config.json');
  if (!existsSync(configPath)) {
    console.log(chalk.red('  Not a RuvNet-KB-First project.'));
    console.log('');
    console.log(chalk.gray('  Initialize with: npx ruvnet-kb-first init'));
    console.log(chalk.gray('  With KB:         npx ruvnet-kb-first init --kb ask_ruvnet'));
    console.log('');
    return;
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));

  // Knowledge Base Connection (PROMINENT - this is the "Bible")
  if (config.knowledgeBase?.connected) {
    console.log(chalk.white('  Knowledge Base (Authority Source)'));
    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────'));

    // Try to get live count
    let liveCount = config.knowledgeBase.entries;
    let isLive = false;
    try {
      const pg = await import('pg');
      const client = new pg.default.Client({
        host: config.knowledgeBase.host,
        port: config.knowledgeBase.port,
        database: 'postgres',
        user: 'postgres',
        password: 'guruKB2025'
      });
      await client.connect();
      const result = await client.query(
        `SELECT COUNT(*) as count FROM ${config.knowledgeBase.schema}.architecture_docs`
      );
      liveCount = parseInt(result.rows[0].count);
      await client.end();
      isLive = true;
    } catch (e) {
      // Use cached count
    }

    const statusIcon = isLive ? chalk.green('●') : chalk.yellow('○');
    console.log(`  ${statusIcon} Schema:     ${chalk.green(config.knowledgeBase.schema)}`);
    console.log(`    Entries:    ${chalk.cyan(liveCount.toLocaleString())} ${isLive ? chalk.green('(live)') : chalk.yellow('(cached)')}`);
    console.log(`    Host:       ${chalk.gray(config.knowledgeBase.host + ':' + config.knowledgeBase.port)}`);
    console.log('');
    console.log(chalk.gray('  Claude will use this KB to:'));
    console.log(chalk.gray('    • Verify architecture patterns are correct'));
    console.log(chalk.gray('    • Ensure optimal configurations are applied'));
    console.log(chalk.gray('    • Identify missing best practices'));
    console.log(chalk.gray('    • Generate code with proper KB citations'));
    console.log('');
  } else {
    console.log(chalk.white('  Knowledge Base'));
    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────'));
    console.log(chalk.yellow('  ○ Not connected'));
    console.log(chalk.gray('    Reinitialize with: npx ruvnet-kb-first init --kb ask_ruvnet'));
    console.log('');
  }

  // Project Info
  console.log(chalk.white('  Project Information'));
  console.log(chalk.gray('  ─────────────────────────────────────────────────────────────'));
  console.log(`  Name:       ${chalk.cyan(projectName)}`);
  console.log(`  Namespace:  ${chalk.cyan(config.kbFirst?.namespace || 'not set')}`);
  console.log(`  Version:    ${chalk.cyan(config.kbFirst?.version || '5.0.0')}`);
  console.log(`  Initialized: ${chalk.gray(config.kbFirst?.initialized || 'unknown')}`);
  console.log('');

  // Phase Progress
  const currentPhase = config.phases?.current || 0;
  const completedPhases = config.phases?.completed || [];

  console.log(chalk.white('  Phase Progress'));
  console.log(chalk.gray('  ─────────────────────────────────────────────────────────────'));

  for (const phase of PHASES) {
    const isCompleted = completedPhases.includes(phase.num);
    const isCurrent = phase.num === currentPhase;

    let status;
    if (isCompleted) {
      status = chalk.green('✓ Complete');
    } else if (isCurrent) {
      status = chalk.yellow('▶ Current');
    } else if (phase.num < currentPhase) {
      status = chalk.yellow('○ Partial');
    } else {
      status = chalk.gray('○ Pending');
    }

    const phaseNum = phase.num.toString().padStart(4, ' ');
    console.log(`  ${phaseNum}. ${phase.name.padEnd(20)} ${status}`);
  }

  console.log('');

  // Quick Stats
  console.log(chalk.white('  Quick Stats'));
  console.log(chalk.gray('  ─────────────────────────────────────────────────────────────'));

  // Count source files
  const srcDir = join(cwd, 'src');
  let codeFiles = 0;
  let filesWithKB = 0;

  if (existsSync(srcDir)) {
    const files = globSync('**/*.{ts,tsx,js,jsx,py}', { cwd: srcDir });
    codeFiles = files.length;

    for (const file of files) {
      const content = readFileSync(join(srcDir, file), 'utf-8');
      if (content.includes('KB-Generated:') || content.includes('Sources:')) {
        filesWithKB++;
      }
    }
  }

  console.log(`  Code Files:     ${codeFiles}`);
  console.log(`  With KB Cite:   ${filesWithKB} (${codeFiles > 0 ? Math.round((filesWithKB / codeFiles) * 100) : 0}%)`);

  // Count KB gaps
  const gapsPath = join(cwd, '.ruvector', 'gaps.jsonl');
  let gapCount = 0;
  if (existsSync(gapsPath)) {
    const content = readFileSync(gapsPath, 'utf-8').trim();
    gapCount = content ? content.split('\n').length : 0;
  }
  console.log(`  KB Gaps:        ${gapCount}`);

  // Hooks status
  const hooksEnabled = config.hooks?.enabled ? chalk.green('Enabled') : chalk.red('Disabled');
  console.log(`  Hooks:          ${hooksEnabled}`);

  console.log('');

  // Detailed view
  if (options.detailed) {
    await showDetailedStatus(cwd, config);
  }

  // Next Steps
  console.log(chalk.white('  Next Steps'));
  console.log(chalk.gray('  ─────────────────────────────────────────────────────────────'));

  if (config.knowledgeBase?.connected) {
    console.log(chalk.cyan('  → Ask Claude: "Review this app using RuvNet-KB-First"'));
    console.log(chalk.gray('    Claude will query the KB and analyze your code'));
    console.log('');
  }

  if (currentPhase < 11) {
    console.log(chalk.cyan(`  → Run: npx ruvnet-kb-first phase ${currentPhase}`));
    console.log(chalk.gray(`    Complete Phase ${currentPhase}: ${PHASES.find(p => p.num === currentPhase)?.name}`));
  } else {
    console.log(chalk.green('  → All phases complete!'));
    console.log(chalk.gray('    Run: npx ruvnet-kb-first score --detailed'));
  }

  console.log('');
}

async function showDetailedStatus(cwd, config) {
  console.log(chalk.white('  Detailed Status'));
  console.log(chalk.gray('  ─────────────────────────────────────────────────────────────'));

  // Directory structure
  const expectedDirs = [
    '.ruvector',
    '.ruvector/hooks',
    'src',
    'src/kb',
    'phases',
    'scripts',
    'docs'
  ];

  console.log('');
  console.log(chalk.gray('  Directory Structure:'));
  for (const dir of expectedDirs) {
    const exists = existsSync(join(cwd, dir));
    const icon = exists ? chalk.green('✓') : chalk.red('✗');
    console.log(`    ${icon} ${dir}/`);
  }

  // Scripts available
  const scriptsDir = join(cwd, 'scripts');
  if (existsSync(scriptsDir)) {
    const scripts = readdirSync(scriptsDir).filter(f => f.endsWith('.sh'));
    console.log('');
    console.log(chalk.gray(`  Verification Scripts: ${scripts.length}`));
  }

  // Phase documentation
  const phasesDir = join(cwd, 'phases');
  if (existsSync(phasesDir)) {
    const phaseDocs = readdirSync(phasesDir).filter(f => f.endsWith('.md'));
    console.log(chalk.gray(`  Phase Documents: ${phaseDocs.length}`));
  }

  // Sessions
  const sessionsPath = join(cwd, '.ruvector', 'sessions.jsonl');
  if (existsSync(sessionsPath)) {
    const content = readFileSync(sessionsPath, 'utf-8').trim();
    const sessionCount = content ? content.split('\n').length : 0;
    console.log(chalk.gray(`  Sessions Logged: ${sessionCount}`));
  }

  console.log('');
}
