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

function listSourceFiles(relDir) {
  const root = resolve(repoRoot, relDir);
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const full = resolve(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.mts')) {
        out.push(full);
      }
    }
  }
  return out;
}

function rel(absPath) {
  return absPath.replace(`${repoRoot}/`, '');
}

function collectAdapterImports(relDir) {
  const files = listSourceFiles(relDir);
  const imports = new Set();
  const importPattern = /@paperclipai\/adapter-[a-z0-9-]+/g;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const matches = text.match(importPattern);
    if (!matches) continue;
    for (const match of matches) imports.add(match);
  }
  return imports;
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

const appPackages = [
  { packageJson: 'ui/package.json', sourceDir: 'ui/src' },
  { packageJson: 'server/package.json', sourceDir: 'server/src' },
  { packageJson: 'cli/package.json', sourceDir: 'cli/src' },
];
const problems = [];

for (const { packageJson, sourceDir } of appPackages) {
  const pkg = readJson(packageJson);
  const deps = pkg.dependencies || {};

  for (const [name, version] of Object.entries(deps)) {
    if (typeof version !== 'string' || !version.startsWith('workspace:')) continue;
    if (!workspacePackageNames.has(name)) {
      problems.push(
        `${packageJson}: dependency ${name}@${version} is workspace-scoped but no matching workspace package exists`,
      );
    }
  }

  const adapterImports = collectAdapterImports(sourceDir);
  for (const adapterPackage of adapterImports) {
    if (!deps[adapterPackage]) {
      problems.push(
        `${packageJson}: source imports ${adapterPackage} but it is missing from dependencies`,
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
