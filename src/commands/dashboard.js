/**
 * RuvNet-KB-First Dashboard
 *
 * Shows comprehensive status when running `ruvnet-kb-first` with no arguments.
 * Displays KB metrics, application scores, and actionable recommendations.
 */

import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';

export async function dashboardCommand() {
  const cwd = process.cwd();
  const projectName = cwd.split('/').pop();

  // Banner
  console.log('');
  console.log(chalk.cyan('╔════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold.white('                      RuvNet-KB-First Dashboard                        ') + chalk.cyan('║'));
  console.log(chalk.cyan('║') + chalk.gray('                Build intelligent applications on expert knowledge        ') + chalk.cyan('║'));
  console.log(chalk.cyan('╚════════════════════════════════════════════════════════════════════════╝'));
  console.log('');

  // Check if initialized
  const configPath = join(cwd, '.ruvector', 'config.json');
  if (!existsSync(configPath)) {
    console.log(chalk.yellow('  ⚠ Not initialized in this directory'));
    console.log('');
    console.log(chalk.white('  Quick Start:'));
    console.log(chalk.cyan('    ruvnet-kb-first init --kb ask_ruvnet'));
    console.log('');
    console.log(chalk.gray('  This will:'));
    console.log(chalk.gray('    • Connect to the RuvNet Knowledge Base (230K+ entries)'));
    console.log(chalk.gray('    • Set up hooks to enforce KB-first development'));
    console.log(chalk.gray('    • Enable comprehensive scoring for your application'));
    console.log('');
    return;
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: KNOWLEDGE BASE STATUS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(chalk.white.bold('  📚 KNOWLEDGE BASE'));
  console.log(chalk.gray('  ────────────────────────────────────────────────────────────────────'));

  if (config.knowledgeBase?.connected) {
    let kbStats = {
      entries: config.knowledgeBase.entries,
      isLive: false,
      categories: 0,
      avgEmbeddingSize: 0
    };

    // Try to get live stats
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

      // Entry count
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM ${config.knowledgeBase.schema}.architecture_docs`
      );
      kbStats.entries = parseInt(countResult.rows[0].count);
      kbStats.isLive = true;

      // Get category count (if source column exists)
      try {
        const catResult = await client.query(
          `SELECT COUNT(DISTINCT source) as cats FROM ${config.knowledgeBase.schema}.architecture_docs`
        );
        kbStats.categories = parseInt(catResult.rows[0].cats);
      } catch (e) {
        // Ignore if source column doesn't exist
      }

      await client.end();
    } catch (e) {
      // Use cached values
    }

    const statusIcon = kbStats.isLive ? chalk.green('●') : chalk.yellow('○');
    const statusText = kbStats.isLive ? chalk.green('CONNECTED') : chalk.yellow('CACHED');

    console.log(`  ${statusIcon} Status:    ${statusText}`);
    console.log(`    Schema:    ${chalk.cyan(config.knowledgeBase.schema)}`);
    console.log(`    Entries:   ${chalk.cyan(kbStats.entries.toLocaleString())}`);
    if (kbStats.categories > 0) {
      console.log(`    Sources:   ${chalk.cyan(kbStats.categories)}`);
    }
    console.log(`    Host:      ${chalk.gray(config.knowledgeBase.host + ':' + config.knowledgeBase.port)}`);

    // KB Score (out of 100)
    const kbScore = calculateKBScore(kbStats);
    console.log('');
    console.log(`    ${chalk.white('KB Health Score:')} ${renderScoreBar(kbScore)} ${colorScore(kbScore)}/100`);

  } else {
    console.log(chalk.red('  ○ Status:    NOT CONNECTED'));
    console.log('');
    console.log(chalk.yellow('    Run: ruvnet-kb-first init --kb ask_ruvnet'));
  }

  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: APPLICATION SCORES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(chalk.white.bold('  📊 APPLICATION SCORES'));
  console.log(chalk.gray('  ────────────────────────────────────────────────────────────────────'));

  const scores = await calculateAllScores(cwd, config);

  // Display each score category
  for (const [category, data] of Object.entries(scores)) {
    const label = formatLabel(category).padEnd(18);
    const bar = renderScoreBar(data.percentage);
    const scoreText = colorScore(data.percentage);
    console.log(`    ${label} ${bar} ${scoreText.padStart(4)}/100  ${chalk.gray(data.summary)}`);
  }

  // Total Score
  const totalScore = Math.round(
    Object.values(scores).reduce((sum, s) => sum + s.percentage, 0) / Object.keys(scores).length
  );

  console.log('');
  console.log(chalk.gray('  ────────────────────────────────────────────────────────────────────'));
  const totalBar = renderScoreBar(totalScore);
  console.log(`    ${chalk.bold('OVERALL SCORE')}     ${totalBar} ${colorScore(totalScore).padStart(4)}/100  ${getGrade(totalScore)}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: PROJECT INFO
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(chalk.white.bold('  📁 PROJECT'));
  console.log(chalk.gray('  ────────────────────────────────────────────────────────────────────'));
  console.log(`    Name:      ${chalk.cyan(projectName)}`);
  console.log(`    Namespace: ${chalk.cyan(config.kbFirst?.namespace || 'not set')}`);
  console.log(`    Phase:     ${chalk.cyan(config.phases?.current || 0)}/11`);
  console.log(`    Hooks:     ${config.hooks?.enabled ? chalk.green('Enabled') : chalk.red('Disabled')}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const recommendations = getRecommendations(scores, config);

  if (recommendations.length > 0) {
    console.log(chalk.white.bold('  💡 RECOMMENDATIONS'));
    console.log(chalk.gray('  ────────────────────────────────────────────────────────────────────'));
    for (const rec of recommendations.slice(0, 5)) {
      console.log(chalk.yellow(`    → ${rec}`));
    }
    console.log('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5: COMMANDS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(chalk.white.bold('  ⌨️  COMMANDS'));
  console.log(chalk.gray('  ────────────────────────────────────────────────────────────────────'));
  console.log(chalk.cyan('    ruvnet-kb-first score --detailed') + chalk.gray('   Full score breakdown'));
  console.log(chalk.cyan('    ruvnet-kb-first status --detailed') + chalk.gray('  Detailed project status'));
  console.log(chalk.cyan('    ruvnet-kb-first verify') + chalk.gray('             Run verification checks'));
  console.log(chalk.cyan('    ruvnet-kb-first phase <n>') + chalk.gray('          Execute build phase'));
  console.log('');

  // Final prompt
  if (config.knowledgeBase?.connected) {
    console.log(chalk.gray('  Ask Claude: "Review this app using RuvNet-KB-First and recommend improvements"'));
  }
  console.log('');
}

function calculateKBScore(stats) {
  let score = 0;

  // Connection (30 points)
  if (stats.isLive) score += 30;
  else score += 15;

  // Entry count (50 points)
  if (stats.entries >= 100000) score += 50;
  else if (stats.entries >= 50000) score += 40;
  else if (stats.entries >= 10000) score += 30;
  else if (stats.entries >= 1000) score += 20;
  else score += 10;

  // Categories (20 points)
  if (stats.categories >= 50) score += 20;
  else if (stats.categories >= 20) score += 15;
  else if (stats.categories >= 10) score += 10;
  else score += 5;

  return Math.min(score, 100);
}

async function calculateAllScores(cwd, config) {
  const scores = {};

  // 1. KB Coverage
  const srcDir = join(cwd, 'src');
  let kbCoverage = { percentage: 100, summary: 'No code yet' };
  if (existsSync(srcDir)) {
    const codeFiles = globSync('**/*.{ts,tsx,js,jsx,py}', { cwd: srcDir });
    if (codeFiles.length > 0) {
      let withCitation = 0;
      for (const file of codeFiles) {
        const content = readFileSync(join(srcDir, file), 'utf-8');
        if (content.includes('KB-Generated:') || content.includes('Sources:')) {
          withCitation++;
        }
      }
      const pct = Math.round((withCitation / codeFiles.length) * 100);
      kbCoverage = { percentage: pct, summary: `${withCitation}/${codeFiles.length} files` };
    }
  }
  scores.kbCoverage = kbCoverage;

  // 2. Phase Progress
  const completed = config.phases?.completed?.length || 0;
  const phasePct = Math.round((completed / 12) * 100);
  scores.phaseProgress = { percentage: phasePct, summary: `${completed}/12 complete` };

  // 3. Hook Compliance
  let hookPct = 0;
  if (config.hooks?.enabled) {
    const hooksDir = join(cwd, '.ruvector', 'hooks');
    let found = 0;
    if (existsSync(join(hooksDir, 'pre-tool-use.py'))) found++;
    if (existsSync(join(hooksDir, 'post-tool-use.py'))) found++;
    hookPct = found === 2 ? 100 : (found === 1 ? 50 : 0);
  }
  scores.hooks = { percentage: hookPct, summary: hookPct === 100 ? 'All installed' : 'Incomplete' };

  // 4. KB Gaps
  const gapPath = join(cwd, '.ruvector', 'gaps.jsonl');
  let gapPct = 100;
  let gapSummary = 'No gaps';
  if (existsSync(gapPath)) {
    const content = readFileSync(gapPath, 'utf-8').trim();
    if (content) {
      const gaps = content.split('\n').length;
      gapPct = Math.max(0, 100 - (gaps * 10));
      gapSummary = `${gaps} unresolved`;
    }
  }
  scores.kbGaps = { percentage: gapPct, summary: gapSummary };

  // 5. Documentation
  let docScore = 0;
  if (existsSync(join(cwd, 'README.md'))) docScore += 40;
  if (existsSync(join(cwd, 'docs', 'api.md'))) docScore += 30;
  if (existsSync(join(cwd, 'docs', 'architecture.md'))) docScore += 30;
  scores.documentation = { percentage: docScore, summary: docScore === 100 ? 'Complete' : 'Incomplete' };

  // 6. Security
  let secScore = 100;
  const gitignore = join(cwd, '.gitignore');
  if (!existsSync(gitignore)) {
    secScore -= 30;
  } else {
    const content = readFileSync(gitignore, 'utf-8');
    if (!content.includes('.env')) secScore -= 20;
  }
  if (!existsSync(join(cwd, 'package-lock.json')) && existsSync(join(cwd, 'package.json'))) {
    secScore -= 20;
  }
  scores.security = { percentage: Math.max(0, secScore), summary: secScore === 100 ? 'Passed' : 'Issues found' };

  return scores;
}

function renderScoreBar(percentage) {
  const filled = Math.round(percentage / 5);
  const empty = 20 - filled;
  const color = percentage >= 80 ? chalk.green :
               percentage >= 60 ? chalk.yellow :
               percentage >= 40 ? chalk.hex('#FFA500') :
               chalk.red;
  return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

function colorScore(score) {
  const color = score >= 80 ? chalk.green :
               score >= 60 ? chalk.yellow :
               score >= 40 ? chalk.hex('#FFA500') :
               chalk.red;
  return color(score.toString());
}

function formatLabel(key) {
  const labels = {
    kbCoverage: 'KB Coverage',
    phaseProgress: 'Phase Progress',
    hooks: 'Hooks',
    kbGaps: 'KB Gaps',
    documentation: 'Documentation',
    security: 'Security'
  };
  return labels[key] || key;
}

function getGrade(score) {
  if (score >= 95) return chalk.green.bold('A+');
  if (score >= 90) return chalk.green.bold('A');
  if (score >= 85) return chalk.green('A-');
  if (score >= 80) return chalk.yellow.bold('B+');
  if (score >= 75) return chalk.yellow('B');
  if (score >= 70) return chalk.yellow('B-');
  if (score >= 65) return chalk.hex('#FFA500')('C+');
  if (score >= 60) return chalk.hex('#FFA500')('C');
  if (score >= 55) return chalk.hex('#FFA500')('C-');
  return chalk.red.bold('F');
}

function getRecommendations(scores, config) {
  const recs = [];

  if (!config.knowledgeBase?.connected) {
    recs.push('Connect to KB: ruvnet-kb-first init --kb ask_ruvnet --force');
  }

  if (scores.kbCoverage.percentage < 80) {
    recs.push('Add KB citations to code files (use kb_code_gen before writing)');
  }

  if (scores.phaseProgress.percentage < 50) {
    recs.push(`Complete build phases: ruvnet-kb-first phase ${config.phases?.current || 0}`);
  }

  if (scores.hooks.percentage < 100) {
    recs.push('Install enforcement hooks: ruvnet-kb-first hooks --install');
  }

  if (scores.kbGaps.percentage < 100) {
    recs.push('Resolve KB gaps logged in .ruvector/gaps.jsonl');
  }

  if (scores.documentation.percentage < 100) {
    recs.push('Add documentation: README.md, docs/api.md, docs/architecture.md');
  }

  if (scores.security.percentage < 100) {
    recs.push('Fix security issues: ruvnet-kb-first verify --phase=9');
  }

  return recs;
}
