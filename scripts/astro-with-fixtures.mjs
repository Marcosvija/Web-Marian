import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const astroCli = fileURLToPath(new URL('../node_modules/astro/bin/astro.mjs', import.meta.url));
const child = spawn(process.execPath, [astroCli, ...process.argv.slice(2)], {
  env: {
    ...process.env,
    ASTRO_DEV_BACKGROUND: '0',
    WEB_MARIAN_CONTENT_FIXTURES: '1',
  },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
