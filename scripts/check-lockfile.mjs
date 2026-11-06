import { readFileSync } from 'node:fs';
import path from 'node:path';

const lockPath = process.argv[2] ?? 'package-lock.json';
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
const problems = [];
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
if (lock.lockfileVersion !== 3 || !lock.packages?.['']) {
  throw new Error('A complete npm v3 package-lock.json is required.');
}
for (const group of ['dependencies', 'devDependencies']) {
  const expected = manifest[group] ?? {}, recorded = lock.packages[''][group] ?? {};
  if (Object.keys(expected).length !== Object.keys(recorded).length || Object.entries(expected).some(([name, spec]) => recorded[name] !== spec)) {
    problems.push(`${group}: package.json and package-lock.json are out of sync`);
  }
}
function resolvePackage(location, dependency) {
  let directory = location;
  for (;;) {
    const candidate = `${directory ? directory + '/' : ''}node_modules/${dependency}`;
    if (lock.packages[candidate]) return lock.packages[candidate];
    if (!directory) return null;
    const parent = path.posix.dirname(directory);
    directory = parent === '.' ? '' : parent;
  }
}
for (const [location, entry] of Object.entries(lock.packages)) {
  if (!location) continue;
  if (typeof entry.version !== 'string' || !versionPattern.test(entry.version)) problems.push(`${location}: missing or invalid version`);
  if (typeof entry.resolved !== 'string' || !entry.resolved) problems.push(`${location}: missing resolved package URL`);
  if (typeof entry.integrity !== 'string' || !/^sha(?:1|256|384|512)-\S+$/.test(entry.integrity)) problems.push(`${location}: missing package integrity`);
  for (const dependency of Object.keys({ ...entry.dependencies, ...entry.optionalDependencies })) {
    if (!resolvePackage(location, dependency)) problems.push(`${location}: unlocked dependency ${dependency}`);
  }
}
if (problems.length) {
  console.error(`Invalid lockfile (${problems.length} problems):\n${problems.slice(0, 12).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Lockfile valid: ${Object.keys(lock.packages).length - 1} packages with complete versions, URLs, integrity and dependency entries.`);
}
