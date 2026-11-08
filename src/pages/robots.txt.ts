import type { APIRoute } from 'astro';
import { business } from '../config/site';

export const GET: APIRoute = () => {
  const base = business.siteUrl.replace(/\/$/, '');
  const body = `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
