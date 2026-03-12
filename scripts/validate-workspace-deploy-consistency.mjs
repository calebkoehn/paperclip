#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('.', import.meta.url).pathname, '..');

function readJson(relPath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relPath), 'utf8'));
}

function listAdapterPackageJsonPaths() {
  const adaptersDir = resolve(repoRoot, 'packages/adapters');
  return readdirSync(adaptersDir)
    .map((name) => resolve(adaptersDir, name))
    .filter((p) => statSync(p).isDirectory())
    .map((dir) => `${dir}/package.json`);
}

function rel(absPath) {
  return absPath.replace(`${repoRoot}/`, '');
}

const workspacePackageJsons = [
  'package.json',
  'cli/package.json',
  'server/package.json',
  'ui/package.json',
  'packages/shared/package.json',
  'packages/db/package.json',
  'packages/adapter-utils/package.json',
  ...listAdapterPackageJsonPaths().map(rel),
];

const workspacePackageNames = new Set();
for (const pkgPath of workspacePackageJsons) {
  const pkg = readJson(pkgPath);
  if (pkg?.name) workspacePackageNames.add(pkg.name);
}

const appPackages = ['ui/package.json', 'server/package.json', 'cli/package.json'];
const problems = [];

for (const pkgPath of appPackages) {
  const pkg = readJson(pkgPath);
  const deps = pkg.dependencies || {};
  for (const [name, version] of Object.entries(deps)) {
    if (typeof version !== 'string' || !version.startsWith('workspace:')) continue;
    if (!workspacePackageNames.has(name)) {
      problems.push(
        `${pkgPath}: dependency ${name}@${version} is workspace-scoped but no matching workspace package exists`,
      );
    }
  }
}

const dockerfile = readFileSync(resolve(repoRoot, 'Dockerfile'), 'utf8');
if (!dockerfile.includes('COPY packages/adapters packages/adapters')) {
  problems.push('Dockerfile deps stage is missing `COPY packages/adapters packages/adapters` guardrail copy.');
}

if (problems.length > 0) {
  console.error('Workspace/deploy consistency check failed:\n');
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

console.log('Workspace/deploy consistency check passed.');
