import { defineConfig } from 'astro/config';
import { business } from './src/config/site';

// Fully static output (Cloudflare Pages serves /dist; /functions runs the form endpoint).
export default defineConfig({
  site: business.siteUrl,
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file', // /pricing -> pricing.html, served at /pricing by Cloudflare Pages
    inlineStylesheets: 'always', // no render-blocking CSS request
  },
  compressHTML: true,
  vite: {
    build: {
      assetsInlineLimit: 0, // keep scripts external so CSP can stay `script-src 'self'`
    },
  },
});
