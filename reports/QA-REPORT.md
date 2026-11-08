# QA report — London computer repair website

Build date: 2026-11-07 · Astro 7.4.7 · static output + 1 Cloudflare Pages Function

## 1. Lighthouse (mobile emulation, default throttling)

Run locally with Lighthouse + headless Chrome against `astro preview` of the production build
(`reports/lighthouse-*.json` has the raw results). Local preview has no CDN, Brotli or `_headers`, so these are
**lab results, not production measurements**. Re-run PageSpeed Insights on the live URL after deploying.

| Page | Perf | A11y | Best Pr. | SEO | LCP | CLS | TBT | Transfer |
|---|---|---|---|---|---|---|---|---|
| / | 100 | 100 | 100 | 100 | 0.6 s | 0 | 40 ms | 11 KB |
| /computer-repair-london | 99 | 100 | 100 | 100 | 0.6 s | 0 | 120 ms | 9 KB |
| /laptop-repair-london | 100 | 100 | 100 | 100 | 0.6 s | 0 | 10 ms | 9 KB |
| /desktop-repair-london | 100 | 100 | 100 | 100 | 0.6 s | 0 | 0 ms | 8 KB |
| /pricing | 100 | 100 | 100 | 100 | 0.6 s | 0 | 20 ms | 9 KB |
| /about | 100 | 100 | 100 | 100 | 0.6 s | 0 | 10 ms | 8 KB |
| /contact | 100 | 100 | 100 | 100 | 0.6 s | 0 | 10 ms | 10 KB |
| /privacy-policy | 100 | 100 | 100 | 100 | 0.6 s | 0 | 60 ms | 8 KB |

INP cannot be measured in a lab run (field metric); with ~2 KB of JS and no hydration it should be low. Verify with
real-user data in Search Console → Core Web Vitals after launch.

## 2. Performance

Budgets (from `npm run test:site`): HTML + inlined CSS 9.9 KB gzip on the home page; CSS 3.9 KB gzip (budget 50 KB);
JS 1.8 KB gzip total (budget 30 KB). No frameworks, no external fonts, no third-party requests, no raster images on pages
(inline SVG icons), so there is no LCP image to preload and no image-dimension risk. The only image file is the 1200×630
social-share PNG, referenced from `<meta>` only.

Issues found and fixed during testing:
- **CLS 0.113** on every page (over the 0.1 target): the mobile menu collapsed after JS ran, shifting the page. Fixed by making
  the collapsed state the CSS default (with a `<noscript>` fallback). CLS is now 0.
- **Contrast failure** (2.4:1) on the intro text in the dark pricing section. Fixed.
- Form: focus moved to the status banner instead of the first invalid field. Fixed.

Remaining / for production: confirm Brotli, HSTS and cache headers on the live domain (Cloudflare applies them).

## 3. SEO checklist

- [x] Unique title and meta description on all 8 pages (automated duplicate and length check)
- [x] Canonical URL, Open Graph and Twitter card tags on every page; 404 is `noindex`
- [x] Exactly one H1 per page, no skipped heading levels (automated)
- [x] Descriptive URLs, internal linking, breadcrumb navigation + `BreadcrumbList` JSON-LD on inner pages
- [x] `ProfessionalService` JSON-LD with `areaServed` London, Ontario and a labour-price `OfferCatalog`; `FAQPage` on the home page; all JSON-LD parses
- [x] No street address, hours, ratings, reviews or review schema
- [x] `sitemap.xml` (8 URLs, excludes 404) and `robots.txt` generated from the config domain
- [x] Search Console token and Google Business Profile URL fields ready in the config
- [ ] **Owner:** set the real domain in `business.siteUrl` (canonicals/sitemap currently use `https://www.example.com`)
- [ ] **Owner:** submit sitemap in Search Console; create the Google Business Profile as a service-area business
- Not validated here: Google's Rich Results Test (needs a public URL). Run it after deploy.

## 4. Accessibility checklist

- [x] Skip link; first Tab lands on it (tested in Chrome)
- [x] Visible focus styles everywhere; 48 px minimum touch targets on buttons and inputs
- [x] Mobile menu is a real `<button>` with `aria-expanded`/`aria-controls`; Escape closes it and returns focus (tested)
- [x] Every form control has a visible `<label>`; errors are linked with `aria-describedby`, flagged with `aria-invalid`, announced in an `aria-live` region; focus goes to the first invalid field (tested)
- [x] Tables use `<th scope>`; decorative icons are `aria-hidden`; "Learn more" links include the service name for screen readers
- [x] Colour contrast checked by Lighthouse (100 on all pages). Note: secondary text uses `#55657A` rather than the specified `#64748B` so it stays ≥ 4.5:1 on the `#F5F7F8` section background
- [x] `prefers-reduced-motion` honoured; no autoplay media
- [x] No horizontal scroll at 390 / 820 / 1366 px on the home, pricing, contact and laptop pages (tested)
- Not covered: manual screen-reader testing (NVDA/VoiceOver). Recommended before launch.

## 5. Functional tests

- Build, `astro check` (0 errors/warnings), automated verification script: all pass (links and anchors across all pages resolved, sitemap/robots/_headers/_redirects present, no inline executable scripts so the CSP holds).
- Form endpoint, 17 tests (`scripts/test-form.mjs`): returns 503 when email isn't configured (never a fake success), valid submission, server validation, past dates, bad postal code, honeypot, timing trap, cross-origin rejection, HTML escaping, out-of-area flagging, rate limit (6th request → 429), 405 on GET, no-JS redirect. All pass.
- Browser form flow (headless Chrome): empty submit shows 10 field errors; with no backend the page says the request was **not** sent; with a mocked 200 the success message shows.
- Console errors: none (apart from the expected 404 for `/api/...` on the static preview).

**Not tested (needs your accounts / a live site):** a real email through Resend, Cloudflare KV rate limiting, the deployed
`_headers`/`_redirects` behaviour, PageSpeed Insights, tablet/desktop manual visual review of every page (screenshots were
taken for the home page at three widths and the form states).

## 6. Remaining configuration (owner)

1. Business name (`business.name`, `BUSINESS_NAME`), then `python3 scripts/make-og.py "Name"`
2. Domain (`business.siteUrl`) and Cloudflare custom domain
3. Confirm service radius and postal prefixes; confirm warranty wording and the "qualifying repair" definition
4. Resend account + `RESEND_API_KEY`, `REPAIR_TO_EMAIL`, `REPAIR_FROM_EMAIL`; create the `RATE_LIMIT` KV namespace; add the WAF rate-limit rule
5. Optional public email/phone, Google Business Profile URL, Search Console token
6. Review the privacy policy and set a real retention period

Nothing in the site claims rankings or load times are guaranteed.
