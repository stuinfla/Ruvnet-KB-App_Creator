#!/bin/bash
# RuvNet KB-First Global Installer
# Version 5.0.0 | Updated 2026-01-02
#
# Installs KB-First skill, command, hooks, and auto-detection globally to ~/.claude/

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         RuvNet KB-First Application Builder v5.0.0           ║"
echo "║              Global Installation Script                       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Determine script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

# Target directories
CLAUDE_DIR="$HOME/.claude"
SKILLS_DIR="$CLAUDE_DIR/skills"
COMMANDS_DIR="$CLAUDE_DIR/commands"
HOOKS_DIR="$CLAUDE_DIR/hooks"

# Create directories if needed
echo "Creating directories..."
mkdir -p "$SKILLS_DIR"
mkdir -p "$COMMANDS_DIR"
mkdir -p "$HOOKS_DIR"

# Install skill
echo "Installing KB-First skill..."
cp "$SCRIPT_DIR/kb-first-skill.md" "$SKILLS_DIR/kb-first.md"
echo "  ✅ Installed to $SKILLS_DIR/kb-first.md"

# Install command
echo "Installing /kb-first command..."
cp "$SCRIPT_DIR/kb-first-command.md" "$COMMANDS_DIR/kb-first.md"
echo "  ✅ Installed to $COMMANDS_DIR/kb-first.md"

# Install hook scripts
echo "Installing hook scripts..."

if [ -f "$REPO_DIR/phases/01.5-hooks-setup.md" ]; then
  # Extract hook scripts from phase documentation
  # For now, create minimal working hooks

  cat > "$HOOKS_DIR/pre_tool_use.py" << 'HOOK_EOF'
#!/usr/bin/env python3
"""RuVector PreToolUse Hook - KB-First Enforcement"""
import json
import sys

def main():
    try:
        input_data = json.load(sys.stdin)
        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})

        if tool_name not in ('Edit', 'Write', 'MultiEdit'):
            print(json.dumps({"decision": "continue"}))
            return

        file_path = tool_input.get('file_path', '')
        if '/domain/' in file_path or '/src/' in file_path:
            print(json.dumps({
                "decision": "continue",
                "message": "📚 KB-First: Remember to query KB for domain values"
            }))
        else:
            print(json.dumps({"decision": "continue"}))
    except:
        print(json.dumps({"decision": "continue"}))

if __name__ == '__main__':
    main()
HOOK_EOF

  cat > "$HOOKS_DIR/post_tool_use.py" << 'HOOK_EOF'
#!/usr/bin/env python3
"""RuVector PostToolUse Hook - Outcome Recording"""
import json
import sys

def main():
    try:
        input_data = json.load(sys.stdin)
        # Record outcome for SONA learning (stub)
    except:
        pass
    print(json.dumps({"decision": "continue"}))

if __name__ == '__main__':
    main()
HOOK_EOF

  cat > "$HOOKS_DIR/session_end.py" << 'HOOK_EOF'
#!/usr/bin/env python3
"""RuVector SessionEnd Hook - Pattern Persistence"""
import json
import sys

def main():
    try:
        input_data = json.load(sys.stdin)
        # Persist patterns (stub)
    except:
        pass
    print(json.dumps({"decision": "continue"}))

if __name__ == '__main__':
    main()
HOOK_EOF

  chmod +x "$HOOKS_DIR"/*.py
  echo "  ✅ Installed hook scripts to $HOOKS_DIR/"
fi

# Update settings.json to register hooks
echo "Configuring hooks in settings.json..."

SETTINGS_FILE="$CLAUDE_DIR/settings.json"

if [ -f "$SETTINGS_FILE" ]; then
  # Backup existing
  cp "$SETTINGS_FILE" "$SETTINGS_FILE.bak"

  # Check if hooks already configured
  if grep -q '"hooks"' "$SETTINGS_FILE"; then
    echo "  ⚠️  Hooks already configured in settings.json"
    echo "  ℹ️  Review $SETTINGS_FILE to ensure KB-First hooks are active"
  else
    # Add hooks to existing settings
    python3 << PYTHON_EOF
import json

with open('$SETTINGS_FILE', 'r') as f:
    settings = json.load(f)

settings['hooks'] = {
    "PreToolUse": [{
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [{"type": "command", "command": "python3 $HOOKS_DIR/pre_tool_use.py"}]
    }],
    "PostToolUse": [{
        "matcher": "*",
        "hooks": [{"type": "command", "command": "python3 $HOOKS_DIR/post_tool_use.py"}]
    }],
    "SessionEnd": [{
        "matcher": "*",
        "hooks": [{"type": "command", "command": "python3 $HOOKS_DIR/session_end.py"}]
    }]
}

with open('$SETTINGS_FILE', 'w') as f:
    json.dump(settings, f, indent=2)
PYTHON_EOF
    echo "  ✅ Hooks configured in settings.json"
  fi
else
  # Create new settings file
  cat > "$SETTINGS_FILE" << SETTINGS_EOF
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write|MultiEdit",
      "hooks": [{"type": "command", "command": "python3 $HOOKS_DIR/pre_tool_use.py"}]
    }],
    "PostToolUse": [{
      "matcher": "*",
      "hooks": [{"type": "command", "command": "python3 $HOOKS_DIR/post_tool_use.py"}]
    }],
    "SessionEnd": [{
      "matcher": "*",
      "hooks": [{"type": "command", "command": "python3 $HOOKS_DIR/session_end.py"}]
    }]
  }
}
SETTINGS_EOF
  echo "  ✅ Created settings.json with hooks"
fi

# Verify installation
echo ""
echo "Verifying installation..."
echo ""

PASS=0
FAIL=0

if [ -f "$SKILLS_DIR/kb-first.md" ]; then
  echo "  ✅ Skill installed"
  PASS=$((PASS + 1))
else
  echo "  ❌ Skill not found"
  FAIL=$((FAIL + 1))
fi

if [ -f "$COMMANDS_DIR/kb-first.md" ]; then
  echo "  ✅ Command installed"
  PASS=$((PASS + 1))
else
  echo "  ❌ Command not found"
  FAIL=$((FAIL + 1))
fi

if [ -f "$HOOKS_DIR/pre_tool_use.py" ] && [ -x "$HOOKS_DIR/pre_tool_use.py" ]; then
  echo "  ✅ Hooks installed and executable"
  PASS=$((PASS + 1))
else
  echo "  ❌ Hooks not installed or not executable"
  FAIL=$((FAIL + 1))
fi

if grep -q '"hooks"' "$SETTINGS_FILE" 2>/dev/null; then
  echo "  ✅ Hooks configured in settings.json"
  PASS=$((PASS + 1))
else
  echo "  ❌ Hooks not configured"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"

# Install auto-detection hook
echo "Installing auto-detection hook..."
if [ -f "$SCRIPT_DIR/kb-first-autodetect.sh" ]; then
  cp "$SCRIPT_DIR/kb-first-autodetect.sh" "$HOOKS_DIR/kb-first-autodetect.sh"
  chmod +x "$HOOKS_DIR/kb-first-autodetect.sh"
  echo "  ✅ Auto-detection hook installed"
  PASS=$((PASS + 1))
else
  echo "  ⚠️  Auto-detection hook not found in install directory"
fi

if [ $FAIL -eq 0 ]; then
  echo "✅ Installation complete! ($PASS checks passed)"
  echo ""
  echo "Usage:"
  echo "  /kb-first              # Start interactive builder"
  echo "  kb-first init          # Initialize in current project"
  echo "  kb-first score         # Score existing KB and app"
  echo "  kb-first verify        # Run verification checks"
  echo "  kb-first status        # Show project status"
  echo ""
  echo "NPM Package:"
  echo "  npx ruvnet-kb-first init"
  echo "  npx ruvnet-kb-first score --detailed"
  echo ""
  echo "Full documentation: $SKILLS_DIR/kb-first.md"
else
  echo "⚠️  Installation completed with warnings ($PASS passed, $FAIL failed)"
  echo "Review the output above for details."
fi

exit 0
