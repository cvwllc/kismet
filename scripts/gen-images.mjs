// One-time image rasterizer. Run with: node scripts/gen-images.mjs
// Produces:
//   og-image.png   (1200x630, for social preview cards)
//   favicon-32.png (32x32, fallback for older browsers)
//   apple-touch-icon.png (180x180, iOS home-screen icon)
//
// Uses @resvg/resvg-js (pure rust under wasm — no external system deps).

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function render(svgPath, outPath, width) {
  const svg = readFileSync(join(root, svgPath));
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } });
  const png = resvg.render().asPng();
  writeFileSync(join(root, outPath), png);
  console.log(`  ${outPath.padEnd(28)} ${width}px`);
}

console.log('Rendering images:');
render('og-image.svg',  'og-image.png',          1200);
render('favicon.svg',   'favicon-32.png',          32);
render('favicon.svg',   'apple-touch-icon.png',   180);
console.log('Done.');
