#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process';
import readline from 'node:readline';

const message = process.argv[2];

if (!message || message.trim().length === 0) {
  console.error('\n❌ Error: Checkpoint message is required.');
  console.error('Usage: npm run checkpoint "feat: description of changes"\n');
  process.exit(1);
}

function runStep(label, command, args = []) {
  console.log(`\n⏳ Running: ${label} (${command} ${args.join(' ')})...`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`\n❌ Step failed: ${label}`);
    console.error(`Command exited with status code ${result.status}. Aborting checkpoint.\n`);
    process.exit(result.status || 1);
  }
  console.log(`✓ ${label} passed.`);
}

console.log('========================================');
console.log(`🚀 Starting Tiens Bon Checkpoint: "${message.trim()}"`);
console.log('========================================');

// 1. Typecheck
runStep('TypeScript Type Check', 'npm', ['run', 'typecheck']);

// 2. Lint
runStep('Biome Linter & Formatter Check', 'npm', ['run', 'lint']);

// 3. Vitest unit tests
runStep('Unit Tests', 'npm', ['run', 'test']);

// 4. Vite build
runStep('Vite Production Build', 'npm', ['run', 'build']);

// 5. Secret check
runStep('Secrets & Forbidden Files Check', 'node', ['scripts/check-secrets.mjs']);

console.log('\n========================================');
console.log('✓ All verification checks succeeded!');
console.log('========================================\n');

// 7. Git status check and confirmation
let gitStatus = '';
try {
  gitStatus = execSync('git status --short', { encoding: 'utf-8' });
} catch (_err) {
  console.error('⚠️ Could not run "git status". Ensure git is initialized in this repository.');
  process.exit(1);
}

if (!gitStatus.trim()) {
  console.log('No changed files detected to commit.');
  process.exit(0);
}

console.log('Files to be committed:');
console.log(gitStatus);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Commit and push these files? [y/N] ', (answer) => {
  rl.close();
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === 'y' || trimmed === 'yes') {
    try {
      console.log('\nStaging files (git add -A)...');
      execSync('git add -A', { stdio: 'inherit' });

      console.log(`Committing (git commit -m "${message.trim()}")...`);
      execSync(`git commit -m "${message.trim().replace(/"/g, '\\"')}"`, { stdio: 'inherit' });

      console.log('Pushing to remote (git push)...');
      execSync('git push', { stdio: 'inherit' });

      console.log('\n🎉 Successfully committed and pushed to GitHub!');
    } catch (_err) {
      console.error('\n❌ git push failed.');
      console.error('\nPlain-language troubleshooting hints:');
      console.error('1. GitHub Login: run `gh auth login` or verify your Personal Access Token.');
      console.error('2. Internet connection: verify that you can reach github.com.');
      console.error(
        '3. Upstream branch: if this is your first push on this branch, run: git push -u origin main',
      );
      process.exit(1);
    }
  } else {
    console.log('Aborted. No commit was made.');
  }
});
