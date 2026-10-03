#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FORBIDDEN_FILE_PATTERNS = [
  /^\.env(?:\..+)?$/,
  /^server[/\\]config\.json$/,
  /^\.private-words\.local$/,
  /^data[/\\]/,
  /\.local\.json$/,
  /profile\.real\.json$/,
];

// Construct regexes dynamically to avoid matching the scanner itself
const dashes = '-----';
const PRIVATE_KEY_PATTERNS = [
  new RegExp(`${dashes}BEGIN [A-Z ]*PRIVATE KEY${dashes}`),
  new RegExp(`${dashes}BEGIN ENCRYPTED PRIVATE KEY${dashes}`),
  new RegExp(`${dashes}BEGIN OPENSSH PRIVATE KEY${dashes}`),
  new RegExp(`${dashes}BEGIN PGP PRIVATE KEY BLOCK${dashes}`),
];

const TOKEN_PATTERNS = [
  new RegExp(['ghp_', '[a-zA-Z0-9]{30,}'].join('')),
  new RegExp(['github_pat_', '[a-zA-Z0-9_]{50,}'].join('')),
  new RegExp(['xox[baprs]-', '[a-zA-Z0-9-]{10,}'].join('')),
  new RegExp(['AIza', '[0-9A-Za-z\\-_]{35}'].join('')),
];

function getStagedOrModifiedFiles() {
  const files = new Set();
  try {
    const staged = execSync('git diff --cached --name-only', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    for (const rawLine of staged.split(/\r?\n/)) {
      const trimmed = rawLine.trim();
      if (trimmed) {
        files.add(trimmed);
      }
    }

    const status = execSync('git status --porcelain', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    for (const line of status.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const filePath = trimmed.slice(3).trim();
      if (filePath) files.add(filePath);
    }
  } catch {
    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === 'dist' ||
          entry.name === '.venv' ||
          entry.name === '__pycache__'
        ) {
          continue;
        }
        const full = path.join(dir, entry.name);
        const rel = path.relative('.', full);
        if (entry.isDirectory()) {
          scanDir(full);
        } else {
          files.add(rel);
        }
      }
    }
    scanDir('.');
  }
  return Array.from(files);
}

function loadPrivateWords() {
  const privateWordsFile = path.resolve('.private-words.local');
  if (!fs.existsSync(privateWordsFile)) return [];
  const content = fs.readFileSync(privateWordsFile, 'utf-8');
  return content
    .split(/\r?\n/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !w.startsWith('#'));
}

function checkFile(relPath, privateWords) {
  const normalizedPath = relPath.replace(/\\/g, '/');

  // Allowed exception files
  if (normalizedPath === '.env.example' || normalizedPath === 'scripts/check-secrets.mjs') {
    return null;
  }

  // 1. Check forbidden file paths
  for (const pattern of FORBIDDEN_FILE_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return `Forbidden file path detected: "${normalizedPath}". This file must not be committed to git.`;
    }
  }

  if (!fs.existsSync(relPath)) return null;
  const stat = fs.statSync(relPath);
  if (stat.isDirectory()) return null;

  // Don't scan large binary files (> 1MB) for text secrets
  if (stat.size > 1024 * 1024) return null;

  let content = '';
  try {
    content = fs.readFileSync(relPath, 'utf-8');
  } catch {
    return null;
  }

  for (const pattern of PRIVATE_KEY_PATTERNS) {
    if (pattern.test(content)) {
      return `Private key format found in file: "${normalizedPath}". Private keys must never be committed.`;
    }
  }

  for (const pattern of TOKEN_PATTERNS) {
    if (pattern.test(content)) {
      return `High-entropy secret or API token found in file: "${normalizedPath}".`;
    }
  }

  for (const word of privateWords) {
    if (word.length >= 3 && content.includes(word)) {
      return `Private word match found in file: "${normalizedPath}". The word listed in .private-words.local was detected.`;
    }
  }

  return null;
}

function main() {
  const privateWords = loadPrivateWords();
  const files = getStagedOrModifiedFiles();
  const violations = [];

  for (const file of files) {
    const error = checkFile(file, privateWords);
    if (error) {
      violations.push(error);
    }
  }

  if (violations.length > 0) {
    console.error('\n❌ [SECURITY ERROR] Secrets or forbidden files detected:');
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    console.error('\nPlease remove the forbidden file or secret before committing.');
    process.exit(1);
  }

  console.log('✓ Secrets check passed: no forbidden files or secrets detected.');
  process.exit(0);
}

main();
