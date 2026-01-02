/**
 * KB-First Verify Command
 *
 * Runs verification checks for KB-First compliance.
 */

import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync, chmodSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';

const PHASE_SCRIPTS = {
  0: [], // Assessment - no scripts
  1: [], // KB Design - no scripts
  1.5: ['1.5-hooks-verify.sh'],
  2: [], // Schema - no scripts
  3: [], // Population - no scripts
  4: [], // Scoring - no scripts
  5: [], // Integration - no scripts
  6: [], // Testing - no scripts
  7: [], // Optimization - no scripts
  8: [
    '8.1-code-scan.sh',
    '8.2-import-check.sh',
    '8.3-source-returns.sh',
    '8.4-startup-verify.sh',
    '8.5-fallback-check.sh',
    '8.6-attribution.sh',
    '8.7-confidence.sh',
    '8.8-gap-logging.sh'
  ],
  9: ['9-security-audit.sh'],
  10: [], // Documentation - no scripts
  11: [] // Deployment - no scripts
};

export async function verifyCommand(options) {
  const cwd = process.cwd();

  console.log('');
  console.log(chalk.cyan('Running KB-First Verification Checks...'));
  console.log('');

  // Check if project is initialized
  const configPath = join(cwd, '.ruvector', 'config.json');
  if (!existsSync(configPath)) {
    console.log(chalk.red('Error: Not a KB-First project.'));
    console.log(chalk.gray('Run: kb-first init'));
    return;
  }

  const scriptsDir = join(cwd, 'scripts');

  if (options.phase) {
    // Run specific phase verification
    const phase = parseFloat(options.phase);
    await verifyPhase(cwd, scriptsDir, phase, options.verbose);
  } else if (options.all) {
    // Run all verification scripts
    await verifyAll(cwd, scriptsDir, options.verbose);
  } else {
    // Run basic verification
    await verifyBasic(cwd, options.verbose);
  }
}

async function runScript(scriptPath, cwd, verbose) {
  // Make script executable
  chmodSync(scriptPath, 0o755);

  // Run using bash with execFileSync (safe - no shell interpolation)
  const result = execFileSync('/bin/bash', [scriptPath], {
    cwd,
    stdio: verbose ? 'inherit' : 'pipe',
    timeout: 60000,
    encoding: 'utf-8'
  });

  return result;
}

async function verifyPhase(cwd, scriptsDir, phase, verbose) {
  console.log(chalk.white(`Verifying Phase ${phase}...`));
  console.log('');

  const scripts = PHASE_SCRIPTS[phase];

  if (!scripts || scripts.length === 0) {
    console.log(chalk.yellow(`No verification scripts for Phase ${phase}.`));
    console.log(chalk.gray('Phase verification is manual or done via scoring.'));
    return;
  }

  let passed = 0;
  let failed = 0;

  for (const script of scripts) {
    const scriptPath = join(scriptsDir, script);

    if (!existsSync(scriptPath)) {
      console.log(chalk.yellow(`  Skip: ${script} (not found)`));
      continue;
    }

    const spinner = ora(`Running ${script}...`).start();

    try {
      if (verbose) {
        spinner.stop();
        console.log(chalk.gray(`\n  $ ./${script}\n`));
      }

      await runScript(scriptPath, cwd, verbose);

      spinner.succeed(`${script}`);
      passed++;
    } catch (error) {
      spinner.fail(`${script}`);
      failed++;

      if (verbose && error.stdout) {
        console.log(chalk.gray(error.stdout.toString()));
      }
      if (verbose && error.stderr) {
        console.log(chalk.red(error.stderr.toString()));
      }
    }
  }

  // Summary
  console.log('');
  console.log(chalk.white('═══════════════════════════════════════════════════════════════'));
  console.log(`  Phase ${phase} Verification: ${passed} passed, ${failed} failed`);
  console.log(chalk.white('═══════════════════════════════════════════════════════════════'));
  console.log('');

  if (failed === 0) {
    console.log(chalk.green(`  ✅ Phase ${phase} verification PASSED`));
  } else {
    console.log(chalk.red(`  ❌ Phase ${phase} verification FAILED`));
    console.log(chalk.gray('  Fix failures before proceeding to next phase.'));
  }
}

async function verifyAll(cwd, scriptsDir, verbose) {
  console.log(chalk.white('Running ALL verification scripts...'));
  console.log('');

  let totalPassed = 0;
  let totalFailed = 0;

  for (const [phase, scripts] of Object.entries(PHASE_SCRIPTS)) {
    if (scripts.length === 0) continue;

    console.log(chalk.cyan(`\n--- Phase ${phase} ---\n`));

    for (const script of scripts) {
      const scriptPath = join(scriptsDir, script);

      if (!existsSync(scriptPath)) {
        console.log(chalk.yellow(`  Skip: ${script} (not found)`));
        continue;
      }

      const spinner = ora(`Running ${script}...`).start();

      try {
        await runScript(scriptPath, cwd, verbose);

        spinner.succeed(`${script}`);
        totalPassed++;
      } catch (error) {
        spinner.fail(`${script}`);
        totalFailed++;
      }
    }
  }

  // Summary
  console.log('');
  console.log(chalk.white('═══════════════════════════════════════════════════════════════'));
  console.log(`  Total Verification: ${totalPassed} passed, ${totalFailed} failed`);
  console.log(chalk.white('═══════════════════════════════════════════════════════════════'));
  console.log('');

  if (totalFailed === 0) {
    console.log(chalk.green('  ✅ All verifications PASSED'));
  } else {
    console.log(chalk.red(`  ❌ ${totalFailed} verification(s) FAILED`));
  }
}

async function verifyBasic(cwd, verbose) {
  console.log(chalk.white('Running basic KB-First verification...'));
  console.log('');

  const checks = [];

  // 1. Check .ruvector directory
  checks.push({
    name: 'Configuration',
    pass: existsSync(join(cwd, '.ruvector', 'config.json')),
    details: '.ruvector/config.json exists'
  });

  // 2. Check hooks
  const hooksDir = join(cwd, '.ruvector', 'hooks');
  checks.push({
    name: 'Hooks Directory',
    pass: existsSync(hooksDir),
    details: '.ruvector/hooks/ exists'
  });

  // 3. Check phases directory
  checks.push({
    name: 'Phase Documentation',
    pass: existsSync(join(cwd, 'phases')),
    details: 'phases/ directory exists'
  });

  // 4. Check scripts directory
  checks.push({
    name: 'Verification Scripts',
    pass: existsSync(join(cwd, 'scripts')),
    details: 'scripts/ directory exists'
  });

  // 5. Check src/kb directory
  checks.push({
    name: 'KB Source',
    pass: existsSync(join(cwd, 'src', 'kb')),
    details: 'src/kb/ directory exists'
  });

  // 6. Check for README
  checks.push({
    name: 'README',
    pass: existsSync(join(cwd, 'README.md')),
    details: 'README.md exists'
  });

  // 7. Check .gitignore includes .env
  const gitignorePath = join(cwd, '.gitignore');
  let hasEnvInGitignore = false;
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    hasEnvInGitignore = content.includes('.env');
  }
  checks.push({
    name: 'Security (.env)',
    pass: hasEnvInGitignore,
    details: '.env in .gitignore'
  });

  // Output results
  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    if (check.pass) {
      console.log(chalk.green(`  ✅ ${check.name}: ${check.details}`));
      passed++;
    } else {
      console.log(chalk.red(`  ❌ ${check.name}: ${check.details}`));
      failed++;
    }
  }

  // Summary
  console.log('');
  console.log(chalk.white('═══════════════════════════════════════════════════════════════'));
  console.log(`  Basic Verification: ${passed}/${checks.length} checks passed`);
  console.log(chalk.white('═══════════════════════════════════════════════════════════════'));
  console.log('');

  if (failed === 0) {
    console.log(chalk.green('  ✅ Basic verification PASSED'));
    console.log('');
    console.log(chalk.gray('  Run kb-first verify --all for comprehensive checks'));
  } else {
    console.log(chalk.yellow(`  ⚠️  ${failed} check(s) need attention`));
    console.log('');
    console.log(chalk.gray('  Run kb-first init to set up missing components'));
  }
}
