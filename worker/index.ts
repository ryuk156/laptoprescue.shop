/**
 * Cloudflare Worker entry for deployment with `wrangler deploy` (Workers Builds).
 * - Serves the static site from ./dist through the ASSETS binding (headers, redirects and the 404 page
 *   come from public/_headers, public/_redirects and wrangler.toml).
 * - Handles POST /api/repair-request with the same code used by the Pages Function in /functions.
 */
import { onRequestPost, onRequest } from '../functions/api/repair-request';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/repair-request') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = { request, env: env as any };
      return request.method === 'POST' ? onRequestPost(ctx) : onRequest(ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
