# London Computer Repair — website

Static Astro site (plain CSS, ~2 KB of vanilla JS) for an appointment-based laptop and MacBook repair
business in London, Ontario. Hosted on Cloudflare (Workers); the repair request form runs in the same Worker.

## Quick start

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # production build → dist/
npm run preview      # serve dist/ locally
npm run test:site    # metadata, headings, JSON-LD, links, sitemap, size budgets (run after build)
```

Form endpoint tests: `node --experimental-strip-types scripts/test-form.mjs`

To try the form end-to-end locally (static preview does not run Functions):

```bash
cp .dev.vars.example .dev.vars   # fill in real values
npm run build && npx wrangler pages dev dist
```

## 1. What the owner must configure (everything is a placeholder until you do)

All business details, prices, policies and FAQs live in **`src/config/site.ts`**.

| Item | Where | Notes |
|---|---|---|
| Business name | `business.name` | Set to `laptoprescue.shop`. Also set `BUSINESS_NAME` in `wrangler.toml`, then re-run `python3 scripts/make-og.py "Name"` for the social share image |
| Domain | `business.siteUrl` | Drives canonical URLs, sitemap, robots.txt, Open Graph, JSON-LD |
| Email / phone | `business.email`, `business.phone` | Left empty on purpose; hidden everywhere until set. Never invented |
| Service radius | `serviceArea.radiusKm` | Shown across the site as the free pickup/delivery limit. **Confirm the real number** |
| In-area postal prefixes | `serviceArea.postalPrefixes` (and optional `SERVICE_AREA_PREFIXES` env var) | Out-of-area requests are accepted but flagged for you to confirm; the site never promises pickup outside the area |
| Prices | `DIAGNOSTIC_PRICE` ($29.99), `LABOUR_PRICE` ($35.99), `KEYBOARD_PRICE` ($65), `SCREEN_PRICE` ($90), `MOTHERBOARD_PRICE` ($145) | These numbers drive every page and the JSON-LD |
| Warranty wording | `policies.warranty` | Placeholder says terms are given on the quotation. Replace with your real terms |
| Data disclaimer | `policies.dataDisclaimer` | Shown in the footer, booking form, pricing page and FAQ. Have it reviewed |
| Google Business Profile URL | `business.googleBusinessProfileUrl` | Added to JSON-LD `sameAs` when set |
| Search Console token | `business.googleSearchConsoleToken` | Adds the verification meta tag (or verify by DNS in Cloudflare instead) |
| Privacy policy | `src/pages/privacy-policy.astro` | Written for PIPEDA-style practice and this site's real behaviour (no cookies/analytics). Have it reviewed, and set a data-retention period you actually follow |

Not included, deliberately: street address, opening hours, reviews/ratings, testimonials, credentials,
years of experience, delivery schedule. Add them only when true.

## 2. Deploy to Cloudflare (Workers)

The repo deploys as a Cloudflare Worker that serves the static site and runs the booking form endpoint
(`worker/index.ts`, configured in `wrangler.toml`).

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** and select the repo.
2. Settings (the defaults work):
   - **Root directory:** `/`
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Environment variable:** `NODE_VERSION` = `22`
3. The project name must match `name` in `wrangler.toml` (`laptoprescue-shop`). If your project has a different name, change `name` there.
4. Add the form variables (below) under **Settings → Variables and Secrets**, then redeploy.

CLI alternative: `npm run build && npx wrangler deploy`.

Using Cloudflare **Pages** instead? The same form code also runs as a Pages Function (`functions/api/repair-request.ts`):
create a Pages project, build command `npm run build`, output directory `dist`, and use a `wrangler.toml` that has
`pages_build_output_dir = "./dist"` instead of the Worker settings.

### Environment variables (form)

| Name | Type | Required | Purpose |
|---|---|---|---|
| `RESEND_API_KEY` | **Secret** | yes | API key from [resend.com](https://resend.com). Never commit it |
| `REPAIR_TO_EMAIL` | Variable | yes | Inbox that receives repair requests |
| `REPAIR_FROM_EMAIL` | Variable | yes | Sender on a domain you verified in Resend (e.g. `requests@yourdomain.com`) |
| `BUSINESS_NAME` | Variable | no | Display name in the notification email |
| `SERVICE_AREA_PREFIXES` | Variable | no | Comma-separated postal prefixes, overrides the default list |
| `RATE_LIMIT` | KV binding | recommended | Durable per-IP rate limiting (see `wrangler.toml`) |

**If email delivery is not configured the endpoint returns 503 and the page tells the visitor their request
was NOT sent.** It never shows a fake success.

### Spam protection and rate limiting (no CAPTCHA)

- Hidden honeypot field and a minimum-fill-time check (bots get a quiet success, nothing is sent).
- Same-origin check, body-size cap, strict server-side validation and sanitization, HTML-escaped email.
- 5 requests per IP per hour (KV if bound, best-effort in-memory otherwise).
- Recommended extra layer: Cloudflare **Security → WAF → Rate limiting rules**: match `URI Path equals /api/repair-request`
  and method `POST`, 10 requests per 10 minutes per IP, action Block.
- If spam ever gets through, add Cloudflare Turnstile (free, no puzzles) to the form.

### Custom domain, HTTPS, redirects

1. Pages project → **Custom domains → Set up a custom domain**; follow the DNS prompts (domain on Cloudflare = one click).
2. HTTPS is automatic. Under **SSL/TLS → Edge Certificates** enable *Always Use HTTPS*. `_headers` also sends HSTS.
3. Pick one canonical host (apex or `www`) and add a Cloudflare **Redirect Rule** from the other to it; keep it identical to `business.siteUrl`.
4. In `public/_redirects`, uncomment the `*.pages.dev → your domain` rule so only the real domain gets indexed.
5. Update `business.siteUrl`, rebuild, redeploy.

### Caching and compression

Cloudflare serves from its CDN with Brotli/Gzip automatically. `public/_headers` sets: hashed `/_astro/*` assets cached
for a year (immutable), HTML revalidated on every request, `/api/*` never cached, plus security headers (HSTS, CSP
with `script-src 'self'`, `frame-ancestors 'none'`, nosniff, referrer and permissions policies).
Redirects live in `public/_redirects`. The custom 404 is `src/pages/404.astro` (served automatically by Pages).

## 3. Search setup after launch

1. **Google Search Console:** add the domain property, verify (DNS or the config token), submit `https://yourdomain/sitemap.xml`.
2. **Google Business Profile:** create/claim it as a *service-area business* and hide the address if you work from home;
   use the same business name as the site. Add the profile URL to the config.
3. Request indexing for the 8 pages. Rankings and speed outcomes depend on many factors and cannot be guaranteed.

## 4. Project layout

```
src/config/site.ts        ← business info, prices, service area, policies, FAQs (edit here)
src/layouts/BaseLayout    ← <head>, SEO tags, JSON-LD
src/components/           ← Header, Footer, BookingForm, Faq, Icon, Breadcrumbs, CtaBand, PickupBanner
src/pages/                ← 8 pages + 404 + sitemap.xml.ts + robots.txt.ts
src/styles/global.css     ← all CSS (system fonts, no external requests)
worker/index.ts           ← Worker entry (serves dist/, routes /api/repair-request)
functions/api/            ← repair-request.ts (form handler, also usable as a Pages Function)
public/                   ← _headers, _redirects, favicon, og-image.png
scripts/                  ← verify-build.mjs, test-form.mjs, make-og.py
```
