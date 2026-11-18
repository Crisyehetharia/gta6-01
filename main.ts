// Teluk Cerah — the entry program (Node 22, standard library only).
//
// Hands the game in: copies game/ and screenshots/ from beside this file
// into the output directory and writes dossier.json there with the vendored
// make.fun library's buildDossier. Outside the grader, MAKEFUN_OUTPUT_DIR
// stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The dossier caps are the scorer's own: only text_max_bytes shapes the
// bytes; the rest refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files in all, or a path under game/ over 1000 bytes).

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function handIn() {
  mkdirSync(outDir, { recursive: true });
  copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
  copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`Teluk Cerah handed in to ${outDir} (dossier.json: ${dossier.length} bytes)`);
}

if (!existsSync(join(repoRoot, 'game', 'index.html'))) {
  throw new Error('hand-in refused: game/index.html is missing');
}
if (!existsSync(join(repoRoot, 'screenshots'))) {
  throw new Error('hand-in refused: screenshots/ is missing');
}
handIn();
