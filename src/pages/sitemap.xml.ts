import type { APIRoute } from 'astro';
import { business, sitemapPaths } from '../config/site';

export const GET: APIRoute = () => {
  const base = business.siteUrl.replace(/\/$/, '');
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = sitemapPaths
    .map((p) => `  <url><loc>${base}${p === '/' ? '/' : p}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
