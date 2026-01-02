/**
 * KB-First Score Command
 *
 * Calculates the KB-First compliance score for the current project.
 *
 * Scoring Formula (100 points total):
 * - KB Coverage (25): All code has KB citations
 * - Phase Completion (25): All phases passed gates
 * - Hook Compliance (15): Hooks installed and active
 * - Gap Resolution (15): KB gaps addressed
 * - Documentation (10): Docs complete
 * - Security (10): Security audit passed
 */

import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';

const SCORE_WEIGHTS = {
  kbCoverage: 25,
  phaseCompletion: 25,
  hookCompliance: 15,
  gapResolution: 15,
  documentation: 10,
  security: 10
};

export async function scoreCommand(options) {
  const cwd = process.cwd();

  console.log('');
  console.log(chalk.cyan('Calculating KB-First Compliance Score...'));
  console.log('');

  // Check if project is initialized
  const configPath = join(cwd, '.ruvector', 'config.json');
  if (!existsSync(configPath)) {
    console.log(chalk.red('Error: Not a KB-First project.'));
    console.log(chalk.gray('Run: kb-first init'));
    return;
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const scores = {};

  // 1. KB Coverage Score (25 points)
  const spinner = ora('Checking KB coverage...').start();
  scores.kbCoverage = await calculateKBCoverage(cwd);
  spinner.succeed(`KB Coverage: ${scores.kbCoverage.score}/${SCORE_WEIGHTS.kbCoverage}`);

  // 2. Phase Completion Score (25 points)
  spinner.start('Checking phase completion...');
  scores.phaseCompletion = await calculatePhaseCompletion(cwd, config);
  spinner.succeed(`Phase Completion: ${scores.phaseCompletion.score}/${SCORE_WEIGHTS.phaseCompletion}`);

  // 3. Hook Compliance Score (15 points)
  spinner.start('Checking hook compliance...');
  scores.hookCompliance = await calculateHookCompliance(cwd, config);
  spinner.succeed(`Hook Compliance: ${scores.hookCompliance.score}/${SCORE_WEIGHTS.hookCompliance}`);

  // 4. Gap Resolution Score (15 points)
  spinner.start('Checking gap resolution...');
  scores.gapResolution = await calculateGapResolution(cwd);
  spinner.succeed(`Gap Resolution: ${scores.gapResolution.score}/${SCORE_WEIGHTS.gapResolution}`);

  // 5. Documentation Score (10 points)
  spinner.start('Checking documentation...');
  scores.documentation = await calculateDocumentation(cwd);
  spinner.succeed(`Documentation: ${scores.documentation.score}/${SCORE_WEIGHTS.documentation}`);

  // 6. Security Score (10 points)
  spinner.start('Checking security...');
  scores.security = await calculateSecurity(cwd);
  spinner.succeed(`Security: ${scores.security.score}/${SCORE_WEIGHTS.security}`);

  // Calculate total
  const totalScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0);
  const maxScore = Object.values(SCORE_WEIGHTS).reduce((sum, w) => sum + w, 0);

  // Output
  console.log('');
  console.log(chalk.white('═══════════════════════════════════════════════════════════════'));
  console.log(chalk.bold.white('                    KB-FIRST COMPLIANCE SCORE'));
  console.log(chalk.white('═══════════════════════════════════════════════════════════════'));
  console.log('');

  if (options.detailed) {
    printDetailedScores(scores);
  }

  // Total score with color coding
  const scoreColor = totalScore >= 90 ? chalk.green :
                    totalScore >= 70 ? chalk.yellow :
                    chalk.red;

  console.log(`  Total Score: ${scoreColor.bold(`${totalScore}/${maxScore}`)}`);
  console.log('');

  // Grade
  const grade = getGrade(totalScore);
  console.log(`  Grade: ${scoreColor.bold(grade.letter)} - ${grade.description}`);
  console.log('');

  // Recommendations
  if (totalScore < 100) {
    console.log(chalk.white('  Recommendations:'));
    printRecommendations(scores);
    console.log('');
  }

  // JSON output if requested
  if (options.json) {
    console.log(JSON.stringify({
      totalScore,
      maxScore,
      grade: grade.letter,
      scores
    }, null, 2));
  }

  return totalScore;
}

async function calculateKBCoverage(cwd) {
  const srcDir = join(cwd, 'src');
  if (!existsSync(srcDir)) {
    return { score: 0, details: 'No src directory found' };
  }

  const codeFiles = globSync('**/*.{ts,tsx,js,jsx,py}', { cwd: srcDir });
  if (codeFiles.length === 0) {
    return { score: SCORE_WEIGHTS.kbCoverage, details: 'No code files to check' };
  }

  let filesWithCitation = 0;
  for (const file of codeFiles) {
    const content = readFileSync(join(srcDir, file), 'utf-8');
    if (content.includes('KB-Generated:') || content.includes('Sources:')) {
      filesWithCitation++;
    }
  }

  const coverage = filesWithCitation / codeFiles.length;
  const score = Math.round(coverage * SCORE_WEIGHTS.kbCoverage);

  return {
    score,
    details: `${filesWithCitation}/${codeFiles.length} files have KB citations`,
    coverage: Math.round(coverage * 100)
  };
}

async function calculatePhaseCompletion(cwd, config) {
  const completedPhases = config.phases?.completed || [];
  const totalPhases = 12; // Phases 0-11

  const score = Math.round((completedPhases.length / totalPhases) * SCORE_WEIGHTS.phaseCompletion);

  return {
    score,
    details: `${completedPhases.length}/${totalPhases} phases completed`,
    currentPhase: config.phases?.current || 0,
    completedPhases
  };
}

async function calculateHookCompliance(cwd, config) {
  if (!config.hooks?.enabled) {
    return { score: 0, details: 'Hooks not enabled' };
  }

  const hooksDir = join(cwd, '.ruvector', 'hooks');
  let hookScore = 0;

  // Check for hook files
  const requiredHooks = ['pre-tool-use.py', 'post-tool-use.py'];
  let foundHooks = 0;

  for (const hook of requiredHooks) {
    if (existsSync(join(hooksDir, hook))) {
      foundHooks++;
    }
  }

  // Hooks exist (10 points)
  hookScore += Math.round((foundHooks / requiredHooks.length) * 10);

  // Hooks enabled in config (5 points)
  if (config.hooks.preToolUse && config.hooks.postToolUse) {
    hookScore += 5;
  }

  return {
    score: Math.min(hookScore, SCORE_WEIGHTS.hookCompliance),
    details: `${foundHooks}/${requiredHooks.length} hooks installed`,
    enabled: config.hooks.enabled
  };
}

async function calculateGapResolution(cwd) {
  const gapLogPath = join(cwd, '.ruvector', 'gaps.jsonl');

  if (!existsSync(gapLogPath)) {
    return { score: SCORE_WEIGHTS.gapResolution, details: 'No gaps logged' };
  }

  const gapContent = readFileSync(gapLogPath, 'utf-8').trim();
  if (!gapContent) {
    return { score: SCORE_WEIGHTS.gapResolution, details: 'No gaps logged' };
  }

  const gaps = gapContent.split('\n').filter(Boolean).map(line => JSON.parse(line));
  const unresolvedGaps = gaps.filter(g => !g.resolved);

  // Deduct points for unresolved gaps (max 5 gaps = 0 points)
  const gapPenalty = Math.min(unresolvedGaps.length, 5) * 3;
  const score = Math.max(0, SCORE_WEIGHTS.gapResolution - gapPenalty);

  return {
    score,
    details: `${unresolvedGaps.length} unresolved gaps`,
    totalGaps: gaps.length,
    unresolvedGaps: unresolvedGaps.length
  };
}

async function calculateDocumentation(cwd) {
  const requiredDocs = [
    'README.md',
    'docs/api.md',
    'docs/architecture.md'
  ];

  let foundDocs = 0;
  for (const doc of requiredDocs) {
    if (existsSync(join(cwd, doc))) {
      foundDocs++;
    }
  }

  // Check README has basic sections
  const readmePath = join(cwd, 'README.md');
  let readmeScore = 0;
  if (existsSync(readmePath)) {
    const content = readFileSync(readmePath, 'utf-8');
    if (content.includes('## Installation')) readmeScore += 1;
    if (content.includes('## Usage')) readmeScore += 1;
    if (content.includes('## API')) readmeScore += 1;
  }

  const docScore = Math.round((foundDocs / requiredDocs.length) * 7) + Math.min(readmeScore, 3);

  return {
    score: Math.min(docScore, SCORE_WEIGHTS.documentation),
    details: `${foundDocs}/${requiredDocs.length} required docs found`,
    foundDocs,
    requiredDocs: requiredDocs.length
  };
}

async function calculateSecurity(cwd) {
  let securityScore = SCORE_WEIGHTS.security;
  const issues = [];

  // Check .gitignore for .env
  const gitignorePath = join(cwd, '.gitignore');
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (!content.includes('.env')) {
      securityScore -= 3;
      issues.push('.env not in .gitignore');
    }
  } else {
    securityScore -= 3;
    issues.push('No .gitignore file');
  }

  // Check for hardcoded secrets in src/
  const srcDir = join(cwd, 'src');
  if (existsSync(srcDir)) {
    const files = globSync('**/*.{ts,tsx,js,jsx}', { cwd: srcDir });
    for (const file of files.slice(0, 20)) { // Check first 20 files
      const content = readFileSync(join(srcDir, file), 'utf-8');
      if (/password\s*=\s*['"][^'"]{8,}['"]/.test(content) &&
          !content.includes('process.env')) {
        securityScore -= 2;
        issues.push(`Potential hardcoded secret in ${file}`);
        break;
      }
    }
  }

  // Check npm audit (if package.json exists)
  const packagePath = join(cwd, 'package.json');
  if (existsSync(packagePath)) {
    // Just check if npm audit would pass (simplified check)
    const packageLock = join(cwd, 'package-lock.json');
    if (!existsSync(packageLock)) {
      securityScore -= 2;
      issues.push('No package-lock.json for reproducible builds');
    }
  }

  return {
    score: Math.max(0, securityScore),
    details: issues.length ? issues.join(', ') : 'No security issues found',
    issues
  };
}

function getGrade(score) {
  if (score >= 98) return { letter: 'A+', description: 'Exceptional - Production Ready' };
  if (score >= 93) return { letter: 'A', description: 'Excellent - Minor improvements possible' };
  if (score >= 90) return { letter: 'A-', description: 'Very Good - Nearly production ready' };
  if (score >= 87) return { letter: 'B+', description: 'Good - Some improvements needed' };
  if (score >= 83) return { letter: 'B', description: 'Above Average - Multiple areas need work' };
  if (score >= 80) return { letter: 'B-', description: 'Satisfactory - Several gaps to address' };
  if (score >= 77) return { letter: 'C+', description: 'Fair - Significant work remaining' };
  if (score >= 73) return { letter: 'C', description: 'Needs Work - Many areas incomplete' };
  if (score >= 70) return { letter: 'C-', description: 'Below Average - Major gaps' };
  return { letter: 'F', description: 'Incomplete - Not ready for review' };
}

function printDetailedScores(scores) {
  console.log(chalk.gray('  Category Breakdown:'));
  console.log('');

  for (const [category, data] of Object.entries(scores)) {
    const maxScore = SCORE_WEIGHTS[category];
    const percentage = Math.round((data.score / maxScore) * 100);
    const bar = createProgressBar(percentage);

    console.log(`  ${formatCategoryName(category)}`);
    console.log(`    ${bar} ${data.score}/${maxScore} (${percentage}%)`);
    console.log(chalk.gray(`    ${data.details}`));
    console.log('');
  }
}

function formatCategoryName(name) {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function createProgressBar(percentage) {
  const filled = Math.round(percentage / 5);
  const empty = 20 - filled;
  const color = percentage >= 80 ? chalk.green :
               percentage >= 60 ? chalk.yellow :
               chalk.red;
  return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

function printRecommendations(scores) {
  const recommendations = [];

  if (scores.kbCoverage.score < SCORE_WEIGHTS.kbCoverage) {
    recommendations.push('Add KB citations to code files using kb_code_gen');
  }
  if (scores.phaseCompletion.score < SCORE_WEIGHTS.phaseCompletion) {
    recommendations.push(`Complete Phase ${scores.phaseCompletion.currentPhase}: kb-first phase ${scores.phaseCompletion.currentPhase}`);
  }
  if (scores.hookCompliance.score < SCORE_WEIGHTS.hookCompliance) {
    recommendations.push('Install KB-First hooks: kb-first hooks --install');
  }
  if (scores.gapResolution.score < SCORE_WEIGHTS.gapResolution) {
    recommendations.push('Address unresolved KB gaps in .ruvector/gaps.jsonl');
  }
  if (scores.documentation.score < SCORE_WEIGHTS.documentation) {
    recommendations.push('Add missing documentation (README, API docs, Architecture)');
  }
  if (scores.security.score < SCORE_WEIGHTS.security) {
    recommendations.push('Fix security issues: kb-first verify --phase=9');
  }

  for (const rec of recommendations.slice(0, 5)) {
    console.log(chalk.yellow(`    - ${rec}`));
  }
}
