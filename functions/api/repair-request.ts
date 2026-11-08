/**
 * Cloudflare Pages Function: POST /api/repair-request
 *
 * - Validates and sanitizes every field on the server (client validation is only a convenience).
 * - Spam protection without CAPTCHA scripts: honeypot field, minimum fill time, same-origin check.
 * - Rate limiting: per-IP, using the optional KV binding RATE_LIMIT (durable across isolates);
 *   falls back to best-effort in-memory limiting. Add a Cloudflare WAF rate-limit rule too (see README).
 * - Delivers the request by email through Resend. Secrets come from environment variables only.
 * - If delivery is not configured it returns 503. It never reports a fake success.
 * - Nothing is stored; customer details are not logged.
 */

interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  RESEND_API_KEY?: string;
  REPAIR_TO_EMAIL?: string;
  REPAIR_FROM_EMAIL?: string;
  BUSINESS_NAME?: string;
  /** Comma-separated postal prefixes (FSAs) treated as in-service-area. Optional override. */
  SERVICE_AREA_PREFIXES?: string;
  RATE_LIMIT?: KVNamespaceLike;
}

interface Ctx {
  request: Request;
  env: Env;
}

const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMIT_MAX = 5; // requests
const RATE_LIMIT_WINDOW_S = 60 * 60; // per hour, per IP
const MIN_FILL_MS = 2500;

const DEFAULT_PREFIXES = [
  'N5V', 'N5W', 'N5X', 'N5Y', 'N5Z',
  'N6A', 'N6B', 'N6C', 'N6E', 'N6G', 'N6H', 'N6J', 'N6K', 'N6L', 'N6M', 'N6N', 'N6P',
];

const DEVICE_TYPES = ['Laptop', 'MacBook'];
const PICKUP_TIMES = ['Morning', 'Afternoon', 'Evening', 'No preference'];
const POSTAL_RE = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

const memoryHits = new Map<string, { count: number; resetAt: number }>();

const json = (status: number, body: Record<string, unknown>, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });

/** Browsers posting the form without JS get redirected back with a status; fetch() gets JSON. */
const wantsHtml = (req: Request) => (req.headers.get('Accept') || '').includes('text/html');
const redirectBack = (req: Request, status: string) =>
  new Response(null, { status: 303, headers: { Location: `${new URL(req.url).origin}/contact?status=${status}#book`, 'Cache-Control': 'no-store' } });

const reply = (req: Request, status: number, body: Record<string, unknown>, redirectCode: string, extra: Record<string, string> = {}) =>
  wantsHtml(req) ? redirectBack(req, redirectCode) : json(status, body, extra);

/** Remove control characters, collapse whitespace (single-line fields) and cap length. */
const clean = (v: unknown, max: number, multiline = false): string => {
  let s = typeof v === 'string' ? v : '';
  s = s.normalize('NFKC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  s = multiline ? s.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

async function rateLimited(env: Env, ip: string): Promise<boolean> {
  const key = `rl:${ip}`;
  if (env.RATE_LIMIT) {
    const current = parseInt((await env.RATE_LIMIT.get(key)) || '0', 10);
    if (current >= RATE_LIMIT_MAX) return true;
    await env.RATE_LIMIT.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW_S });
    return false;
  }
  const now = Date.now();
  const entry = memoryHits.get(key);
  if (!entry || entry.resetAt < now) {
    memoryHits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_S * 1000 });
    if (memoryHits.size > 5000) for (const [k, v] of memoryHits) if (v.resetAt < now) memoryHits.delete(k);
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function tomorrowISO(): string {
  // Dates are compared as plain YYYY-MM-DD strings in Toronto time.
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const d = new Date(`${parts}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  // 1. Same-origin only.
  const origin = request.headers.get('Origin');
  if (origin) {
    let ok = false;
    try { ok = new URL(origin).host === new URL(request.url).host; } catch { /* invalid origin */ }
    if (!ok) return json(403, { ok: false, error: 'forbidden' });
  }

  // 2. Body size + parsing (JSON from fetch, or urlencoded/multipart from a no-JS form).
  const declared = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (declared > MAX_BODY_BYTES) return json(413, { ok: false, error: 'too_large' });

  let raw: Record<string, unknown> = {};
  try {
    const type = request.headers.get('Content-Type') || '';
    if (type.includes('application/json')) {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return json(413, { ok: false, error: 'too_large' });
      raw = JSON.parse(text);
    } else {
      raw = Object.fromEntries((await request.formData()).entries());
    }
  } catch {
    return reply(request, 400, { ok: false, error: 'bad_request' }, 'error');
  }
  if (!raw || typeof raw !== 'object') return reply(request, 400, { ok: false, error: 'bad_request' }, 'error');

  // 3. Honeypot and timing trap: bots get a quiet, generic success and nothing is sent.
  const honeypot = clean(raw.website, 200);
  const ts = parseInt(String(raw.ts ?? ''), 10);
  const tooFast = Number.isFinite(ts) && Date.now() - ts < MIN_FILL_MS;
  if (honeypot || tooFast) {
    return reply(request, 200, { ok: true, message: 'Thank you — your repair request was sent.' }, 'success');
  }

  // 4. Delivery must be configured; otherwise be honest about it.
  if (!env.RESEND_API_KEY || !env.REPAIR_TO_EMAIL || !env.REPAIR_FROM_EMAIL) {
    return reply(request, 503, { ok: false, error: 'not_configured' }, 'unavailable');
  }

  // 5. Rate limit per IP.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (await rateLimited(env, ip)) {
    return reply(request, 429, { ok: false, error: 'rate_limited' }, 'ratelimit', { 'Retry-After': String(RATE_LIMIT_WINDOW_S) });
  }

  // 6. Validate + sanitize.
  const data = {
    name: clean(raw.name, 100),
    email: clean(raw.email, 254).toLowerCase(),
    phone: clean(raw.phone, 25),
    postalCode: clean(raw.postalCode, 7).toUpperCase().replace(/\s|-/g, ''),
    deviceType: clean(raw.deviceType, 20),
    manufacturer: clean(raw.manufacturer, 60),
    model: clean(raw.model, 80),
    problem: clean(raw.problem, 2000, true),
    pickupDate: clean(raw.pickupDate, 10),
    pickupTime: clean(raw.pickupTime, 20),
    comments: clean(raw.comments, 1000, true),
    consent: clean(raw.consent, 5),
  };

  const errors: Record<string, string> = {};
  if (data.name.length < 2) errors.name = 'Please enter your full name.';
  if (!EMAIL_RE.test(data.email)) errors.email = 'Please enter a valid email address.';
  if (data.phone.replace(/\D/g, '').length < 10 || /[^\d\s+().-]/.test(data.phone)) errors.phone = 'Please enter a phone number with area code.';
  if (!POSTAL_RE.test(data.postalCode)) errors.postalCode = 'Please enter a valid Canadian postal code.';
  if (!DEVICE_TYPES.includes(data.deviceType)) errors.deviceType = 'Please choose a device type.';
  if (!data.manufacturer) errors.manufacturer = 'Please enter the manufacturer.';
  if (data.problem.length < 10) errors.problem = 'Please describe the problem in at least 10 characters.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.pickupDate) || Number.isNaN(Date.parse(data.pickupDate))) errors.pickupDate = 'Please choose a valid pickup date.';
  else if (data.pickupDate < tomorrowISO()) errors.pickupDate = 'Please choose a date from tomorrow onward.';
  if (!PICKUP_TIMES.includes(data.pickupTime)) errors.pickupTime = 'Please choose a preferred time.';
  if (data.consent !== 'yes' && data.consent !== 'true' && data.consent !== 'on') errors.consent = 'Please agree to the Privacy Policy to continue.';

  if (Object.keys(errors).length) {
    return reply(request, 422, { ok: false, error: 'validation', errors }, 'error');
  }

  // 7. Service-area check (flag only — a person confirms eligibility).
  const prefixes = (env.SERVICE_AREA_PREFIXES ? env.SERVICE_AREA_PREFIXES.split(',') : DEFAULT_PREFIXES).map((p) => p.trim().toUpperCase());
  const inArea = prefixes.includes(data.postalCode.slice(0, 3));
  const prettyPostal = `${data.postalCode.slice(0, 3)} ${data.postalCode.slice(3)}`;

  // 8. Build and send the email. All user content is HTML-escaped.
  const business = env.BUSINESS_NAME || 'Repair website';
  const rows: [string, string][] = [
    ['Name', data.name], ['Email', data.email], ['Phone', data.phone],
    ['Postal code', `${prettyPostal} — ${inArea ? 'inside configured service area' : 'OUTSIDE configured service area: confirm before promising pickup'}`],
    ['Device', `${data.deviceType} — ${data.manufacturer}${data.model ? ' ' + data.model : ''}`],
    ['Preferred pickup', `${data.pickupDate}, ${data.pickupTime}`],
    ['Problem', data.problem], ['Comments', data.comments || '—'],
  ];
  const html = `<h2>New repair request</h2><table cellpadding="6" style="border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><th align="left" valign="top">${escapeHtml(k)}</th><td style="white-space:pre-wrap">${escapeHtml(v)}</td></tr>`)
    .join('')}</table><p style="color:#666">Consent to privacy policy: yes. Appointments are subject to availability.</p>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');

  let sent = false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${business} <${env.REPAIR_FROM_EMAIL}>`,
        to: [env.REPAIR_TO_EMAIL],
        reply_to: data.email,
        subject: `Repair request: ${data.deviceType} (${data.manufacturer}) — ${data.name}`.replace(/[\r\n]+/g, ' ').slice(0, 200),
        html,
        text,
      }),
    });
    sent = res.ok;
  } catch {
    sent = false;
  }

  if (!sent) return reply(request, 502, { ok: false, error: 'delivery_failed' }, 'error');

  return reply(
    request,
    200,
    {
      ok: true,
      message: inArea
        ? 'Thank you — your repair request was sent. We’ll be in touch to confirm pickup.'
        : 'Thank you — your repair request was sent. Your postal code may be outside our free pickup area, so we’ll confirm what’s possible when we contact you.',
    },
    'success',
  );
};

// Anything other than POST is not allowed.
export const onRequest = async ({ request }: Ctx): Promise<Response> =>
  request.method === 'POST'
    ? json(500, { ok: false, error: 'unexpected' })
    : json(405, { ok: false, error: 'method_not_allowed' }, { Allow: 'POST' });
