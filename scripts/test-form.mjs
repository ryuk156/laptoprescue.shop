// Exercises the Pages Function directly with mocked requests and a mocked email API.
// Run: node --experimental-strip-types scripts/test-form.mjs
import { onRequestPost, onRequest } from '../functions/api/repair-request.ts';

let failures = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failures++; };

const tomorrow = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 2); return d.toISOString().slice(0, 10); })();
const good = {
  name: 'Jane Doe', email: 'jane@example.com', phone: '519-555-0123', postalCode: 'N6A 1A1', deviceType: 'Laptop',
  manufacturer: 'Dell', model: 'XPS 13', problem: 'Screen is cracked after a fall.', pickupDate: tomorrow,
  pickupTime: 'Morning', comments: '', consent: 'yes', website: '', ts: String(Date.now() - 10000),
};
const configured = { RESEND_API_KEY: 'k', REPAIR_TO_EMAIL: 'owner@example.com', REPAIR_FROM_EMAIL: 'r@example.com', BUSINESS_NAME: 'Test Co' };

let sentEmails = [];
globalThis.fetch = async (url, init) => { sentEmails.push({ url, body: JSON.parse(init.body) }); return new Response('{}', { status: 200 }); };

const post = (body, env, headers = {}, ip = '1.1.1.1') =>
  onRequestPost({
    request: new Request('https://site.test/api/repair-request', {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...headers },
    }), env,
  });

let r = await post(good, {});
check('503 (not a fake success) when email delivery is not configured', r.status === 503 && (await r.json()).error === 'not_configured');

r = await post(good, configured, {}, '2.2.2.2');
check('valid request succeeds (200, ok:true)', r.status === 200 && (await r.json()).ok === true);
check('email sent once, to the owner, with reply_to = customer', sentEmails.length === 1 && sentEmails[0].body.to[0] === 'owner@example.com' && sentEmails[0].body.reply_to === 'jane@example.com');
check('API key only sent as Authorization header, not in body', !JSON.stringify(sentEmails[0].body).includes('"k"'));

sentEmails = [];
r = await post({ ...good, name: '', email: 'bad', consent: '' }, configured, {}, '3.3.3.3');
let j = await r.json();
check('server-side validation → 422 with field errors', r.status === 422 && j.errors.name && j.errors.email && j.errors.consent);
check('no email sent for invalid input', sentEmails.length === 0);

r = await post({ ...good, pickupDate: '2020-01-01' }, configured, {}, '3.3.3.4');
check('past pickup date rejected', r.status === 422 && (await r.json()).errors.pickupDate);

r = await post({ ...good, postalCode: 'ZZZ 999' }, configured, {}, '3.3.3.5');
check('invalid postal code rejected', r.status === 422 && (await r.json()).errors.postalCode);

r = await post({ ...good, deviceType: 'Toaster' }, configured, {}, '3.3.3.6');
check('device type must be one of the allowed values', r.status === 422 && (await r.json()).errors.deviceType);

sentEmails = [];
r = await post({ ...good, website: 'http://spam.example' }, configured, {}, '4.4.4.4');
check('honeypot: quiet 200, nothing sent', r.status === 200 && sentEmails.length === 0);

r = await post({ ...good, ts: String(Date.now()) }, configured, {}, '4.4.4.5');
check('timing trap (instant submit): nothing sent', r.status === 200 && sentEmails.length === 0);

r = await post(good, configured, { Origin: 'https://evil.example' }, '5.5.5.5');
check('cross-origin POST rejected (403)', r.status === 403);

sentEmails = [];
r = await post({ ...good, name: '<script>alert(1)</script>', problem: 'x<img src=x onerror=alert(1)> broken screen' }, configured, {}, '6.6.6.6');
const html = sentEmails[0]?.body.html || '';
check('user input is HTML-escaped in the email', r.status === 200 && !html.includes('<script>') && !html.includes('<img') && html.includes('&lt;script&gt;'));

sentEmails = [];
r = await post({ ...good, postalCode: 'M5V 2T6' }, configured, {}, '7.7.7.7');
j = await r.json();
check('out-of-area postal code: accepted but flagged in email and reply', r.status === 200 && /OUTSIDE/.test(sentEmails[0].body.text) && /outside/i.test(j.message));

const codes = [];
for (let i = 0; i < 7; i++) codes.push((await post(good, configured, {}, '8.8.8.8')).status);
check('rate limit: 6th+ request from one IP → 429', codes.slice(0, 5).every((c) => c === 200) && codes[5] === 429, codes.join(','));

r = await onRequest({ request: new Request('https://site.test/api/repair-request', { method: 'GET' }), env: {} });
check('GET not allowed (405)', r.status === 405 && r.headers.get('Allow') === 'POST');

r = await onRequestPost({
  request: new Request('https://site.test/api/repair-request', { method: 'POST', body: new URLSearchParams(Object.fromEntries(Object.entries(good))), headers: { Accept: 'text/html', 'CF-Connecting-IP': '9.9.9.9' } }),
  env: configured,
});
check('no-JS form post → 303 redirect back to /contact?status=success', r.status === 303 && r.headers.get('Location').includes('/contact?status=success'));

console.log(failures ? `\n${failures} FAILED` : '\nAll form endpoint tests passed.');
process.exit(failures ? 1 : 0);
