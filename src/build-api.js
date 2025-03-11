#!/usr/bin/env node

import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [join(__dirname, 'src', 'api', 'server.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outdir: join(__dirname, 'dist', 'api'),
  format: 'esm',
  sourcemap: true,
}).catch(() => process.exit(1));