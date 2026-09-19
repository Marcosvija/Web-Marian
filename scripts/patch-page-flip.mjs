import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { bundles, patchBundle, version } from '../patches/page-flip-2.0.7.mjs';

const require = createRequire(import.meta.url);
const root = dirname(require.resolve('page-flip/package.json'));
const installed = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (installed.version !== version) throw new Error(`Lifecycle patch requires page-flip@${version}`);
const digest = (content) => createHash('sha256').update(content).digest('hex');

// Validate every file before writing either; never accept an unknown distribution.
const pending = [];
for (const [name, hashes] of Object.entries(bundles)) {
  const path = join(root, 'dist/js', name);
  const source = await readFile(path, 'utf8');
  const hash = digest(source);
  if (hash === hashes.patched) continue;
  if (hash !== hashes.upstream) throw new Error(`Unexpected page-flip bundle: ${name}`);
  const patched = patchBundle(source);
  if (digest(patched) !== hashes.patched) throw new Error(`Unexpected patch output: ${name}`);
  pending.push([path, patched]);
}
for (const [path, content] of pending) await writeFile(path, content);
console.log(`page-flip@${version}: lifecycle patch verified (${pending.length} bundles applied)`);
