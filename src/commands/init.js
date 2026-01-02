/**
 * KB-First Init Command
 *
 * Initializes KB-First structure in the current project.
 */

import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Known KB schemas with descriptions
const KNOWN_KB_SCHEMAS = {
  'ask_ruvnet': {
    description: 'RuvNet comprehensive knowledge base (230K+ entries)',
    path: '/Users/stuartkerr/Code/Ask-Ruvnet'
  },
  'retirewell': {
    description: 'Retirement planning knowledge base',
    path: '/Users/stuartkerr/Code/RetireWell'
  },
  'presentermode': {
    description: 'Presentation and public speaking knowledge',
    path: null
  }
};

// Project structure template
const PROJECT_STRUCTURE = {
  directories: [
    '.ruvector',
    '.ruvector/hooks',
    '.ruvector/domain',
    'src',
    'src/kb',
    'docs',
    'phases',
    'scripts',
    'templates'
  ],
  files: {
    '.ruvector/config.json': {
      kbFirst: {
        version: '6.2.0',
        initialized: new Date().toISOString(),
        namespace: '',
        minConfidence: 0.5,
        gapLogging: true
      },
      knowledgeBase: {
        schema: null,
        host: 'localhost',
        port: 5435,
        database: 'postgres',
        table: 'architecture_docs',
        entries: 0,
        connected: false
      },
      hooks: {
        enabled: true,
        preToolUse: true,
        postToolUse: true,
        sessionEnd: true
      },
      phases: {
        current: 0,
        completed: []
      }
    }
  }
};

export async function initCommand(options) {
  const cwd = process.cwd();
  const projectName = cwd.split('/').pop().toLowerCase().replace(/[^a-z0-9]/g, '_');

  console.log('');
  console.log(chalk.cyan('Initializing RuvNet-KB-First project structure...'));
  console.log('');

  // Check if already initialized
  const configPath = join(cwd, '.ruvector', 'config.json');
  if (existsSync(configPath) && !options.force) {
    console.log(chalk.yellow('Project already initialized.'));
    console.log(chalk.gray('Use --force to reinitialize.'));
    return;
  }

  // Interactive prompts if not forcing
  let config = JSON.parse(JSON.stringify(PROJECT_STRUCTURE.files['.ruvector/config.json']));
  config.kbFirst.initialized = new Date().toISOString();

  // Handle --kb flag for connecting to existing KB
  let kbSchema = options.kb;
  const kbHost = options.kbHost || 'localhost';
  const kbPort = options.kbPort || '5435';

  if (!options.force && !kbSchema) {
    // Show available KBs if not specified
    const kbChoices = [
      { name: 'None - Create new KB for this project', value: null },
      ...Object.entries(KNOWN_KB_SCHEMAS).map(([schema, info]) => ({
        name: `${schema} - ${info.description}`,
        value: schema
      })),
      { name: 'Other - Enter custom schema name', value: '__custom__' }
    ];

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'kbSchema',
        message: 'Connect to existing Knowledge Base?',
        choices: kbChoices
      },
      {
        type: 'input',
        name: 'customSchema',
        message: 'Enter KB schema name:',
        when: (answers) => answers.kbSchema === '__custom__'
      },
      {
        type: 'input',
        name: 'namespace',
        message: 'Project namespace (for new content):',
        default: projectName
      },
      {
        type: 'confirm',
        name: 'installHooks',
        message: 'Install KB-First hooks?',
        default: options.hooks !== false
      },
      {
        type: 'list',
        name: 'template',
        message: 'Project template:',
        choices: [
          { name: 'Basic - Simple KB structure', value: 'basic' },
          { name: 'API - REST API with KB search', value: 'api' },
          { name: 'Fullstack - Complete web application', value: 'fullstack' }
        ],
        default: options.template || 'basic'
      }
    ]);

    kbSchema = answers.kbSchema === '__custom__' ? answers.customSchema : answers.kbSchema;
    config.kbFirst.namespace = answers.namespace || projectName;
    config.hooks.enabled = answers.installHooks;
  } else {
    config.kbFirst.namespace = projectName;
  }

  // Connect to KB if specified
  if (kbSchema) {
    const spinner = ora(`Connecting to KB schema: ${kbSchema}...`).start();

    try {
      const pg = await import('pg');
      const client = new pg.default.Client({
        host: kbHost,
        port: parseInt(kbPort),
        database: 'postgres',
        user: 'postgres',
        password: 'guruKB2025'
      });

      await client.connect();

      // Check if schema exists and count entries
      const schemaCheck = await client.query(
        `SELECT COUNT(*) as count FROM information_schema.schemata WHERE schema_name = $1`,
        [kbSchema]
      );

      if (schemaCheck.rows[0].count === '0') {
        spinner.fail(`KB schema '${kbSchema}' not found`);
        await client.end();
        console.log(chalk.yellow('\nAvailable schemas:'));
        Object.entries(KNOWN_KB_SCHEMAS).forEach(([name, info]) => {
          console.log(chalk.gray(`  ${name} - ${info.description}`));
        });
        return;
      }

      // Count entries
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM ${kbSchema}.architecture_docs`
      );
      const entryCount = parseInt(countResult.rows[0].count);

      await client.end();

      // Update config with KB connection
      config.knowledgeBase = {
        schema: kbSchema,
        host: kbHost,
        port: parseInt(kbPort),
        database: 'postgres',
        table: 'architecture_docs',
        entries: entryCount,
        connected: true,
        connectedAt: new Date().toISOString()
      };

      spinner.succeed(`Connected to KB: ${kbSchema} (${entryCount.toLocaleString()} entries)`);

    } catch (err) {
      spinner.fail(`Failed to connect to KB: ${err.message}`);
      console.log(chalk.yellow('\nMake sure the ruvector-kb container is running:'));
      console.log(chalk.gray('  docker ps | grep ruvector-kb'));
    }
  }

  // Create directories
  const spinner = ora('Creating directory structure...').start();

  for (const dir of PROJECT_STRUCTURE.directories) {
    const dirPath = join(cwd, dir);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
  }

  spinner.succeed('Directory structure created');

  // Write config
  spinner.start('Writing configuration...');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  spinner.succeed('Configuration written');

  // Copy phase documentation
  spinner.start('Copying phase documentation...');
  const phasesSource = join(__dirname, '..', '..', 'phases');
  const phasesTarget = join(cwd, 'phases');

  if (existsSync(phasesSource)) {
    const { globSync } = await import('glob');
    const phaseFiles = globSync('*.md', { cwd: phasesSource });

    for (const file of phaseFiles) {
      const source = join(phasesSource, file);
      const target = join(phasesTarget, file);
      if (!existsSync(target)) {
        copyFileSync(source, target);
      }
    }
    spinner.succeed(`Copied ${phaseFiles.length} phase documents`);
  } else {
    spinner.warn('Phase documentation not found - skipping');
  }

  // Copy verification scripts
  spinner.start('Copying verification scripts...');
  const scriptsSource = join(__dirname, '..', '..', 'scripts');
  const scriptsTarget = join(cwd, 'scripts');

  if (existsSync(scriptsSource)) {
    const { globSync } = await import('glob');
    const scriptFiles = globSync('*.sh', { cwd: scriptsSource });

    for (const file of scriptFiles) {
      const source = join(scriptsSource, file);
      const target = join(scriptsTarget, file);
      if (!existsSync(target)) {
        copyFileSync(source, target);
      }
    }
    spinner.succeed(`Copied ${scriptFiles.length} verification scripts`);
  } else {
    spinner.warn('Verification scripts not found - skipping');
  }

  // Install hooks if requested
  if (config.hooks.enabled && options.hooks !== false) {
    spinner.start('Installing KB-First hooks...');
    await installHooks(cwd);
    spinner.succeed('Hooks installed');
  }

  // Create .gitignore entries
  spinner.start('Updating .gitignore...');
  const gitignorePath = join(cwd, '.gitignore');
  const gitignoreEntries = [
    '',
    '# KB-First',
    '.ruvector/domain/',
    '.ruvector/cache/',
    '*.embedding',
    ''
  ].join('\n');

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (!content.includes('# KB-First')) {
      writeFileSync(gitignorePath, content + gitignoreEntries);
    }
  } else {
    writeFileSync(gitignorePath, gitignoreEntries);
  }
  spinner.succeed('.gitignore updated');

  // Summary
  console.log('');
  console.log(chalk.green('RuvNet-KB-First project initialized successfully!'));
  console.log('');

  // Show KB connection status
  if (config.knowledgeBase.connected) {
    console.log(chalk.white('Knowledge Base:'));
    console.log(chalk.green(`  ✓ Connected to: ${config.knowledgeBase.schema}`));
    console.log(chalk.gray(`    ${config.knowledgeBase.entries.toLocaleString()} entries available`));
    console.log(chalk.gray(`    Host: ${config.knowledgeBase.host}:${config.knowledgeBase.port}`));
    console.log('');
  }

  console.log(chalk.white('Project structure:'));
  console.log(chalk.gray('  .ruvector/         - KB configuration and hooks'));
  console.log(chalk.gray('  src/kb/            - Knowledge base modules'));
  console.log(chalk.gray('  phases/            - Build phase documentation'));
  console.log(chalk.gray('  scripts/           - Verification scripts'));
  console.log('');
  console.log(chalk.white('Next steps:'));
  console.log(chalk.cyan('  1. Run: npx ruvnet-kb-first status'));
  console.log(chalk.cyan('  2. Start Phase 0: npx ruvnet-kb-first phase 0'));
  if (config.knowledgeBase.connected) {
    console.log(chalk.cyan('  3. Ask Claude: "Review this app using RuvNet-KB-First and recommend improvements"'));
  } else {
    console.log(chalk.cyan('  3. Build your KB in src/kb/'));
  }
  console.log('');
}

async function installHooks(projectDir) {
  const hooksDir = join(projectDir, '.ruvector', 'hooks');

  // PreToolUse hook
  const preToolUseHook = `#!/usr/bin/env python3
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
`;

  // PostToolUse hook
  const postToolUseHook = `#!/usr/bin/env python3
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
`;

  writeFileSync(join(hooksDir, 'pre-tool-use.py'), preToolUseHook);
  writeFileSync(join(hooksDir, 'post-tool-use.py'), postToolUseHook);

  // Make executable
  const { chmodSync } = await import('fs');
  chmodSync(join(hooksDir, 'pre-tool-use.py'), 0o755);
  chmodSync(join(hooksDir, 'post-tool-use.py'), 0o755);
}
