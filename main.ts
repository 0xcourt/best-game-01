// ANGKOT RUSH — the entry program for best-game-01 (Node 22, standard library only).
//
// The game lives in this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library, no
// network request at run time). This program hands the game in. It copies game/
// and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, using the vendored
// make.fun library in vendor/makefun-game.ts.
//
// Play the game locally by serving game/ with any static file server and
// opening game/index.html in desktop Chrome. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree(join(here, 'game'), join(outDir, 'game'));
if (existsSync(join(here, 'screenshots'))) {
  copyTree(join(here, 'screenshots'), join(outDir, 'screenshots'));
}

// The scorer's own caps, from the kit's RULES.txt: the dossier text is capped
// at 160 KiB; screenshots are at most 4 files of 256 KiB each; game/ holds at
// most 993 files and 48 MiB in all, with every path under 1,000 bytes.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
