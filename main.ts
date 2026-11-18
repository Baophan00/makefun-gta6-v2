// Hand-in plumbing: copy the playable game and its staged screenshots into the output
// directory, then let the vendored, unmodified library write the dossier from what we copied.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// A missing source would only make buildDossier fail later with a less useful message.
function bring(source: string, target: string): void {
  if (!existsSync(source)) throw new Error(`missing hand-in tree: ${source}`);
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

mkdirSync(out, { recursive: true });
bring(join(root, 'game'), join(out, 'game'));
bring(join(root, 'screenshots'), join(out, 'screenshots'));

// The scorer's own limits: only text_max_bytes shapes the dossier, the rest refuse an entry
// the judge would refuse. They are passed through so this build fails where the judge does.
const limits = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};
writeFileSync(join(out, 'dossier.json'), buildDossier(out, limits));
