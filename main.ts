// Competition entry builder: copy the static game and screenshots to the output
// directory, then write the dossier the scorer expects. Node 22 runs this file
// directly via type stripping; no install or build step is required.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const output = process.env.OUTPUT_DIR ?? process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(join(here, 'game'), join(output, 'game'), { recursive: true });
cpSync(join(here, 'screenshots'), join(output, 'screenshots'), { recursive: true });

const dossier = buildDossier(output, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(output, 'dossier.json'), dossier);
console.log(`NEON BREAKER entry written to ${output}`);
