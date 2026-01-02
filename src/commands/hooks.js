/**
 * KB-First Hooks Command
 *
 * Manages KB-First hooks for enforcement.
 */

import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';

const HOOK_TEMPLATES = {
  'pre-tool-use.py': `#!/usr/bin/env python3
"""
KB-First PreToolUse Hook
Intercepts Write operations to enforce KB-First patterns.
"""

import json
import sys
import os

def check_kb_first(tool_input):
    """Check if Write operation follows KB-First principles."""
    if tool_input.get('tool_name') != 'Write':
        return {'decision': 'approve'}

    file_path = tool_input.get('tool_input', {}).get('file_path', '')
    content = tool_input.get('tool_input', {}).get('content', '')

    # Check if it's a code file
    code_extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java']
    is_code_file = any(file_path.endswith(ext) for ext in code_extensions)

    if not is_code_file:
        return {'decision': 'approve'}

    # Check for KB citation header
    has_kb_citation = 'KB-Generated:' in content or 'Sources:' in content

    if not has_kb_citation:
        return {
            'decision': 'block',
            'message': 'KB-First Violation: Code files must include KB citation header. Use kb_code_gen first.'
        }

    return {'decision': 'approve'}

if __name__ == '__main__':
    try:
        input_data = json.loads(sys.stdin.read())
        result = check_kb_first(input_data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'decision': 'approve', 'error': str(e)}))
`,

  'post-tool-use.py': `#!/usr/bin/env python3
"""
KB-First PostToolUse Hook
Tracks KB usage and logs gaps.
"""

import json
import sys
import os
from datetime import datetime

def track_kb_usage(tool_result):
    """Track KB search results and log gaps."""
    tool_name = tool_result.get('tool_name', '')

    # Track KB searches
    if 'kb_search' in tool_name or 'kb_code_gen' in tool_name:
        result = tool_result.get('tool_result', {})
        coverage = result.get('kb_coverage', 'unknown')

        if coverage == 'gap':
            log_gap(tool_result)

    return {'status': 'ok'}

def log_gap(tool_result):
    """Log KB gap for future improvement."""
    gap_log = os.path.join(os.getcwd(), '.ruvector', 'gaps.jsonl')

    # Ensure directory exists
    os.makedirs(os.path.dirname(gap_log), exist_ok=True)

    gap_entry = {
        'timestamp': datetime.now().isoformat(),
        'query': tool_result.get('tool_input', {}).get('query', ''),
        'description': tool_result.get('tool_input', {}).get('description', ''),
        'file_path': tool_result.get('tool_input', {}).get('file_path', '')
    }

    with open(gap_log, 'a') as f:
        f.write(json.dumps(gap_entry) + '\\n')

if __name__ == '__main__':
    try:
        input_data = json.loads(sys.stdin.read())
        result = track_kb_usage(input_data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'status': 'error', 'error': str(e)}))
`,

  'session-end.py': `#!/usr/bin/env python3
"""
KB-First SessionEnd Hook
Generates session summary and updates metrics.
"""

import json
import sys
import os
from datetime import datetime

def session_summary(session_data):
    """Generate KB-First session summary."""
    cwd = os.getcwd()
    summary_file = os.path.join(cwd, '.ruvector', 'sessions.jsonl')

    # Ensure directory exists
    os.makedirs(os.path.dirname(summary_file), exist_ok=True)

    # Count KB operations
    kb_searches = session_data.get('kb_searches', 0)
    kb_writes = session_data.get('kb_writes', 0)
    gaps_logged = session_data.get('gaps_logged', 0)

    summary = {
        'timestamp': datetime.now().isoformat(),
        'duration_minutes': session_data.get('duration_minutes', 0),
        'kb_searches': kb_searches,
        'kb_writes': kb_writes,
        'gaps_logged': gaps_logged,
        'files_modified': session_data.get('files_modified', [])
    }

    with open(summary_file, 'a') as f:
        f.write(json.dumps(summary) + '\\n')

    return {'status': 'ok', 'summary': summary}

if __name__ == '__main__':
    try:
        input_data = json.loads(sys.stdin.read())
        result = session_summary(input_data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'status': 'error', 'error': str(e)}))
`
};

export async function hooksCommand(options) {
  const cwd = process.cwd();

  console.log('');
  console.log(chalk.cyan('KB-First Hooks Manager'));
  console.log('');

  if (options.install) {
    await installHooks(cwd);
  } else if (options.verify) {
    await verifyHooks(cwd);
  } else if (options.train) {
    await trainHooks(cwd);
  } else if (options.status) {
    await showHookStatus(cwd);
  } else {
    // Default: show status
    await showHookStatus(cwd);
  }
}

async function installHooks(cwd) {
  const spinner = ora('Installing KB-First hooks...').start();

  const hooksDir = join(cwd, '.ruvector', 'hooks');

  // Create hooks directory
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  // Write hook files
  for (const [filename, content] of Object.entries(HOOK_TEMPLATES)) {
    const hookPath = join(hooksDir, filename);
    writeFileSync(hookPath, content);
    chmodSync(hookPath, 0o755);
  }

  // Update config
  const configPath = join(cwd, '.ruvector', 'config.json');
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    config.hooks = {
      enabled: true,
      preToolUse: true,
      postToolUse: true,
      sessionEnd: true,
      installedAt: new Date().toISOString()
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  spinner.succeed('Hooks installed successfully');

  console.log('');
  console.log(chalk.white('Installed hooks:'));
  console.log(chalk.gray('  - pre-tool-use.py   (KB citation enforcement)'));
  console.log(chalk.gray('  - post-tool-use.py  (Gap logging)'));
  console.log(chalk.gray('  - session-end.py    (Session summary)'));
  console.log('');
  console.log(chalk.yellow('Note: Add hooks to Claude Code settings.json:'));
  console.log(chalk.gray(`
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [".ruvector/hooks/pre-tool-use.py"]
      }
    ],
    "PostToolUse": [".ruvector/hooks/post-tool-use.py"],
    "SessionEnd": [".ruvector/hooks/session-end.py"]
  }
  `));
}

async function verifyHooks(cwd) {
  console.log(chalk.white('Verifying hooks installation...'));
  console.log('');

  const hooksDir = join(cwd, '.ruvector', 'hooks');
  const requiredHooks = ['pre-tool-use.py', 'post-tool-use.py', 'session-end.py'];

  let passed = 0;
  let failed = 0;

  for (const hook of requiredHooks) {
    const hookPath = join(hooksDir, hook);

    if (existsSync(hookPath)) {
      // Check if executable
      try {
        const { statSync } = await import('fs');
        const stats = statSync(hookPath);
        const isExecutable = (stats.mode & 0o111) !== 0;

        if (isExecutable) {
          console.log(chalk.green(`  ✅ ${hook}`));
          passed++;
        } else {
          console.log(chalk.yellow(`  ⚠️  ${hook} (not executable)`));
          failed++;
        }
      } catch {
        console.log(chalk.red(`  ❌ ${hook} (error checking)`));
        failed++;
      }
    } else {
      console.log(chalk.red(`  ❌ ${hook} (not found)`));
      failed++;
    }
  }

  console.log('');
  if (failed === 0) {
    console.log(chalk.green('All hooks verified successfully.'));
  } else {
    console.log(chalk.yellow(`${failed} hook(s) need attention.`));
    console.log(chalk.gray('Run: kb-first hooks --install'));
  }
}

async function trainHooks(cwd) {
  const spinner = ora('Pre-training hooks with KB-First patterns...').start();

  // Create training data for ReasoningBank
  const trainingPatterns = [
    {
      pattern: 'KB citation required for code files',
      trigger: 'Write to .ts, .tsx, .js, .jsx, .py files',
      action: 'Check for KB-Generated: or Sources: header',
      consequence: 'Block if missing KB citation'
    },
    {
      pattern: 'Gap logging on KB search',
      trigger: 'kb_search or kb_code_gen returns coverage=gap',
      action: 'Log to .ruvector/gaps.jsonl',
      consequence: 'Track for future KB improvement'
    },
    {
      pattern: 'Session summary on end',
      trigger: 'Session ends',
      action: 'Write summary to .ruvector/sessions.jsonl',
      consequence: 'Track KB usage metrics'
    }
  ];

  const patternsPath = join(cwd, '.ruvector', 'training-patterns.json');
  writeFileSync(patternsPath, JSON.stringify(trainingPatterns, null, 2));

  spinner.succeed('Hooks pre-trained with KB-First patterns');

  console.log('');
  console.log(chalk.white('Training patterns installed:'));
  for (const pattern of trainingPatterns) {
    console.log(chalk.gray(`  - ${pattern.pattern}`));
  }
}

async function showHookStatus(cwd) {
  const configPath = join(cwd, '.ruvector', 'config.json');
  const hooksDir = join(cwd, '.ruvector', 'hooks');

  if (!existsSync(configPath)) {
    console.log(chalk.red('Not a KB-First project.'));
    console.log(chalk.gray('Run: kb-first init'));
    return;
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const hooksConfig = config.hooks || {};

  console.log(chalk.white('Hook Status:'));
  console.log('');
  console.log(`  Enabled: ${hooksConfig.enabled ? chalk.green('Yes') : chalk.red('No')}`);
  console.log(`  PreToolUse: ${hooksConfig.preToolUse ? chalk.green('Active') : chalk.gray('Inactive')}`);
  console.log(`  PostToolUse: ${hooksConfig.postToolUse ? chalk.green('Active') : chalk.gray('Inactive')}`);
  console.log(`  SessionEnd: ${hooksConfig.sessionEnd ? chalk.green('Active') : chalk.gray('Inactive')}`);

  if (hooksConfig.installedAt) {
    console.log(`  Installed: ${chalk.gray(hooksConfig.installedAt)}`);
  }

  console.log('');

  // Check files
  const hookFiles = ['pre-tool-use.py', 'post-tool-use.py', 'session-end.py'];
  const foundHooks = hookFiles.filter(f => existsSync(join(hooksDir, f)));

  console.log(chalk.white('Hook Files:'));
  console.log(`  ${foundHooks.length}/${hookFiles.length} hooks installed`);

  // Show gaps count if any
  const gapsPath = join(cwd, '.ruvector', 'gaps.jsonl');
  if (existsSync(gapsPath)) {
    const gapsContent = readFileSync(gapsPath, 'utf-8').trim();
    const gapCount = gapsContent ? gapsContent.split('\n').length : 0;
    console.log(`  ${chalk.yellow(gapCount)} KB gaps logged`);
  }

  console.log('');
  console.log(chalk.gray('Commands:'));
  console.log(chalk.gray('  kb-first hooks --install   Install hooks'));
  console.log(chalk.gray('  kb-first hooks --verify    Verify installation'));
  console.log(chalk.gray('  kb-first hooks --train     Pre-train with patterns'));
}
