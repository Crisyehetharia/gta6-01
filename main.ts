// Bandar Pelita — entrypoint: copy game/ + screenshots/ to the output dir and
// write /output/dossier.json via the kit's buildDossier (vendor/makefun-game.ts).
// Node 22 stdlib only. Deterministic: same input writes the same bytes.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { buildDossier } from './vendor/makefun-game.ts';

const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync('game', `${out}/game`, { recursive: true });
cpSync('screenshots', `${out}/screenshots`, { recursive: true });
writeFileSync(
  `${out}/dossier.json`,
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  }),
);
console.log(`Bandar Pelita entry written to ${out}`);
