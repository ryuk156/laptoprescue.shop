// Post-build verification: run `npm run build && npm run test:site`.
// Checks metadata, headings, JSON-LD, internal links + anchors, sitemap/robots, asset sizes, JS shipped.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url).pathname;
const problems = [];
const fail = (m) => problems.push(m);

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(dist);
const pages = files.filter((f) => f.endsWith('.html'));

const routeOf = (f) => {
  const r = f.slice(dist.length - 1).replace(/\.html$/, '').replace(/\/index$/, '') || '/';
  return r;
};
const routes = new Set(pages.map(routeOf));

const titles = new Map();
const descs = new Map();
const idsByRoute = new Map();
const report = [];

for (const f of pages) {
  const route = routeOf(f);
  const html = readFileSync(f, 'utf8');
  const get = (re) => (html.match(re) || [])[1];
  const title = get(/<title>([^<]*)<\/title>/);
  const desc = get(/<meta name="description" content="([^"]*)"/);
  const canon = get(/<link rel="canonical" href="([^"]*)"/);
  const robots = get(/<meta name="robots" content="([^"]*)"/);
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  idsByRoute.set(route, ids);

  if (!title) fail(`${route}: missing <title>`);
  if (!desc) fail(`${route}: missing meta description`);
  if (!canon) fail(`${route}: missing canonical`);
  if (h1s !== 1) fail(`${route}: expected exactly 1 <h1>, found ${h1s}`);
  if (!/<html lang="/.test(html)) fail(`${route}: missing html lang`);
  if (!html.includes('property="og:title"')) fail(`${route}: missing Open Graph tags`);
  if (title) { if (titles.has(title)) fail(`${route}: duplicate title with ${titles.get(title)}`); titles.set(title, route); }
  if (desc) { if (descs.has(desc)) fail(`${route}: duplicate description with ${descs.get(desc)}`); descs.set(desc, route); }
  if (title && title.length > 70) fail(`${route}: title is ${title.length} chars (aim ≤ 70)`);
  if (desc && (desc.length > 170 || desc.length < 70)) fail(`${route}: description is ${desc.length} chars (aim 70–170)`);

  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt="/.test(m[0])) fail(`${route}: <img> without alt`);
    if (!/\bwidth="/.test(m[0]) || !/\bheight="/.test(m[0])) fail(`${route}: <img> without width/height`);
  }
  // Heading order: no skipped levels (h1 -> h3 etc.)
  let prev = 0;
  for (const m of html.matchAll(/<h([1-6])[\s>]/g)) {
    const lvl = Number(m[1]);
    if (prev && lvl > prev + 1) fail(`${route}: heading level jumps h${prev} -> h${lvl}`);
    prev = lvl;
  }
  // JSON-LD must parse
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { fail(`${route}: invalid JSON-LD (${e.message})`); }
  }
  // Inline executable scripts would break the CSP
  for (const m of html.matchAll(/<script\b([^>]*)>/g)) {
    if (!/type="application\/ld\+json"/.test(m[1]) && !/\bsrc="/.test(m[1])) fail(`${route}: inline script (CSP script-src 'self' would block it)`);
  }
  report.push({ route, title, h1s, robots });
}

// Internal links + anchors
for (const f of pages) {
  const route = routeOf(f);
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/\shref="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|#?$)/.test(href) && !href.startsWith('#')) continue;
    const [pathPart, hash] = href.split('#');
    const target = pathPart === '' ? route : pathPart.replace(/\/$/, '') || '/';
    const isAsset = /\.(svg|png|ico|xml|txt|css|js)$/.test(target);
    if (isAsset) { if (!existsSync(join(dist, target))) fail(`${route}: missing asset ${href}`); continue; }
    if (!routes.has(target)) { fail(`${route}: broken link ${href}`); continue; }
    if (hash && !idsByRoute.get(target)?.has(hash)) fail(`${route}: link ${href} points to missing anchor`);
  }
}

// Sitemap & robots
const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (locs.length !== pages.length - 1) fail(`sitemap has ${locs.length} URLs, expected ${pages.length - 1} (all pages except 404)`);
if (sitemap.includes('/404')) fail('sitemap must not include /404');
const robots = readFileSync(join(dist, 'robots.txt'), 'utf8');
if (!/Sitemap: https?:\/\/.+\/sitemap\.xml/.test(robots)) fail('robots.txt missing Sitemap line');
if (!existsSync(join(dist, '_headers')) || !existsSync(join(dist, '_redirects'))) fail('_headers/_redirects missing from dist');

// Asset sizes (gzip / brotli)
const sum = (exts) => files.filter((f) => exts.includes(extname(f))).map((f) => {
  const b = readFileSync(f);
  return { f: f.slice(dist.length), raw: b.length, gz: gzipSync(b).length, br: brotliCompressSync(b).length };
});
const js = sum(['.js']);
const home = readFileSync(join(dist, 'index.html'));
const css = [...readFileSync(join(dist, 'index.html'), 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => Buffer.from(m[1]));
const cssGz = css.reduce((a, b) => a + gzipSync(b).length, 0);
const homeGz = gzipSync(home).length;
const total = (arr, k) => arr.reduce((a, b) => a + b[k], 0);

console.log('\n=== Pages ===');
for (const r of report) console.log(`${r.route.padEnd(26)} h1=${r.h1s}  ${r.robots}`);
console.log('\n=== Weight (compressed) ===');
console.log(`Home HTML incl. inlined CSS : ${(homeGz / 1024).toFixed(1)} KB gzip`);
console.log(`Inline CSS on home          : ${(cssGz / 1024).toFixed(1)} KB gzip   (budget 50 KB)`);
console.log(`JS files shipped            : ${js.length}, ${(total(js, 'gz') / 1024).toFixed(1)} KB gzip total (budget 30 KB)`);
for (const j of js) console.log(`  ${j.f}  ${(j.gz / 1024).toFixed(2)} KB gzip`);
if (total(js, 'gz') > 30 * 1024) fail('JS exceeds 30 KB gzip budget');
if (cssGz > 50 * 1024) fail('CSS exceeds 50 KB gzip budget');

console.log(problems.length ? `\n${problems.length} problem(s):` : '\nAll checks passed.');
for (const p of problems) console.log(' - ' + p);
process.exit(problems.length ? 1 : 0);
