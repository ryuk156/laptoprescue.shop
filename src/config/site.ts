/**
 * CENTRAL CONFIGURATION — edit this file to change business details, pricing,
 * service area and policy wording across the whole site.
 *
 * Anything marked `TODO` is a placeholder the business owner must confirm.
 */

export interface Business {
  name: string; siteUrl: string; city: string; region: string; regionCode: string; country: string;
  countryCode: string; email: string; phone: string; googleBusinessProfileUrl: string;
  googleSearchConsoleToken: string; formEndpoint: string; privacyLastUpdated: string;
}

export const business: Business = {
  /** TODO: final business name. Used in header, footer, titles, JSON-LD and emails. */
  name: 'laptoprescue.shop',
  /** TODO: production domain (no trailing slash). Drives canonical URLs, sitemap, robots, OG tags. */
  siteUrl: 'https://www.example.com',

  city: 'London',
  region: 'Ontario',
  regionCode: 'ON',
  country: 'Canada',
  countryCode: 'CA',

  /**
   * TODO (optional): public contact details. Leave empty ('') until real ones exist —
   * nothing is invented. Empty values are hidden everywhere (footer, contact page, JSON-LD).
   */
  email: '',
  phone: '',

  /** TODO (optional): Google Business Profile URL, added to JSON-LD `sameAs` when set. */
  googleBusinessProfileUrl: '',
  /** TODO (optional): content value of Google Search Console "HTML tag" verification. */
  googleSearchConsoleToken: '',

  /** Form endpoint (Cloudflare Pages Function in /functions/api/repair-request.ts). */
  formEndpoint: '/api/repair-request',

  /** Shown on the privacy policy. */
  privacyLastUpdated: '2026-11-07',
};

/** Pickup / drop-off service area. Radius and postal prefixes are configurable. */
export const serviceArea = {
  /** TODO: confirm the real radius. Shown on the site as the current free pickup / delivery limit. */
  radiusKm: 15,
  /**
   * Forward sortation areas (first 3 characters of the postal code) treated as inside the
   * service area. Requests from other postal codes are still accepted but flagged for manual review
   * and the customer is told eligibility will be confirmed.
   * TODO: confirm against the real service radius.
   */
  postalPrefixes: [
    'N5V', 'N5W', 'N5X', 'N5Y', 'N5Z',
    'N6A', 'N6B', 'N6C', 'N6E', 'N6G', 'N6H', 'N6J', 'N6K', 'N6L', 'N6M', 'N6N', 'N6P',
  ],
} as const;

/** Money helper: 29.99 -> "$29.99" */
export const money = (n: number): string =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);

/* ----------------------------- PRICING ----------------------------- */

/** Prices. Change these numbers to update the whole site. */
export const DIAGNOSTIC_PRICE = 29.99;
/** Standard labour for most repairs. */
export const LABOUR_PRICE = 35.99;
export const KEYBOARD_PRICE = 65;
export const SCREEN_PRICE = 90;
export const MOTHERBOARD_PRICE = 145;
export const MACBOOK_BATTERY_PRICE = 55;
/** Starting labour for other MacBook repairs (shown as "From"). */
export const MACBOOK_OTHER_PRICE = 65;

export const standardDiagnostic = {
  name: 'Diagnostic',
  price: DIAGNOSTIC_PRICE,
  note: 'Covers finding out what is wrong with your device. The fee is non-refundable and is not credited against repairs.',
};

export interface Repair {
  id: string;
  name: string;
  /** Labour price (parts, shipping and taxes are additional). */
  price: number;
  /** Show as "From $X". */
  from?: boolean;
}

export const repairs: Repair[] = [
  { id: 'windows', name: 'Windows installation', price: LABOUR_PRICE },
  { id: 'ssd', name: 'SSD installation', price: LABOUR_PRICE },
  { id: 'ram', name: 'RAM upgrade', price: LABOUR_PRICE },
  { id: 'keyboard', name: 'Keyboard replacement', price: KEYBOARD_PRICE },
  { id: 'battery', name: 'Battery replacement', price: LABOUR_PRICE },
  { id: 'screen', name: 'Screen replacement', price: SCREEN_PRICE },
  { id: 'motherboard', name: 'Motherboard issues', price: MOTHERBOARD_PRICE },
  { id: 'macbook-battery', name: 'MacBook battery replacement', price: MACBOOK_BATTERY_PRICE },
  { id: 'macbook-other', name: 'Other MacBook repairs (after diagnosis)', price: MACBOOK_OTHER_PRICE, from: true },
  { id: 'cleaning', name: 'Internal cleaning', price: LABOUR_PRICE },
  { id: 'thermal', name: 'Thermal paste replacement', price: LABOUR_PRICE },
];

export const repairById = (id: string): Repair => {
  const r = repairs.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown repair id: ${id}`);
  return r;
};

/* ------------------------------ SERVICES ----------------------------- */

export interface ServiceCard {
  id: string;
  title: string;
  icon: string;
  description: string;
  repairId: string;
  href: string;
}

/** The nine service cards shown on the homepage, in order. */
export const serviceCards: ServiceCard[] = [
  { id: 'keyboard', title: 'Laptop Keyboard Replacement', icon: 'keyboard', repairId: 'keyboard', href: '/laptop-repair-london#keyboard-replacement', description: 'Sticky, unresponsive or spill-damaged keys replaced with a compatible keyboard.' },
  { id: 'screen', title: 'Laptop Screen Replacement', icon: 'laptop', repairId: 'screen', href: '/laptop-repair-london#screen-replacement', description: 'Cracked, flickering or dim displays swapped and tested before return.' },
  { id: 'battery', title: 'Battery Replacement', icon: 'battery', repairId: 'battery', href: '/laptop-repair-london#battery-replacement', description: 'Restore usable battery life when your laptop dies away from the charger.' },
  { id: 'macbook-battery', title: 'MacBook Battery Replacement', icon: 'battery', repairId: 'macbook-battery', href: '/macbook-repair-london', description: 'A new battery for a MacBook that no longer lasts or shows a battery warning.' },
  { id: 'ssd', title: 'SSD Upgrades', icon: 'ssd', repairId: 'ssd', href: '/laptop-repair-london#ssd-upgrades', description: 'Replace a slow hard drive with a solid-state drive for faster start-up and loading.' },
  { id: 'ram', title: 'RAM Upgrades', icon: 'ram', repairId: 'ram', href: '/laptop-repair-london#ram-upgrades', description: 'More memory for smoother multitasking, where your model supports it.' },
  { id: 'windows', title: 'Windows Installation', icon: 'windows', repairId: 'windows', href: '/computer-repair-london#windows-installation', description: 'A clean Windows install to fix corruption, slowdowns or a fresh start.' },
  { id: 'cleaning', title: 'Laptop Cleaning', icon: 'sparkle', repairId: 'cleaning', href: '/laptop-repair-london#internal-cleaning', description: 'Dust removal and thermal paste attention for hot, noisy laptops.' },
  { id: 'motherboard', title: 'Motherboard Issues', icon: 'chip', repairId: 'motherboard', href: '/laptop-repair-london#motherboard-issues', description: 'Laptops that will not power on or charge, after a diagnostic to find the fault.' },
];

/* ---------------------------- POLICY TEXT ---------------------------- */

export const policies = {
  /** TODO: replace with real warranty terms when confirmed. */
  warranty:
    'Warranty terms depend on the repair and the parts used, and are stated in writing on your quotation before you approve any work. Replacement parts may also carry the manufacturer’s own warranty.',
  /** Deliberately no promised turnaround. */
  turnaround:
    'Repair time depends on the fault and on parts availability. We give you an estimate with your quotation, before you approve anything.',
  dataDisclaimer:
    'We are not responsible for any data on your device. Please back up your files before handing it over. Repairs, upgrades and software installs can result in data loss.',
  appointmentNotice: 'Appointments are subject to availability. Your preferred date and time is a request, not a guaranteed booking.',
  macbook:
    'Yes. We replace MacBook batteries and carry out other MacBook repairs. Parts and what is possible vary by model and year, so we confirm everything in your quotation before you approve any work.',
} as const;

/* -------------------------------- FAQ -------------------------------- */

export interface FaqItem { q: string; a: string }

export const faqs: FaqItem[] = [
  { q: 'How much does a laptop diagnostic cost?', a: `The diagnostic is ${money(DIAGNOSTIC_PRICE)}. Most repairs are ${money(LABOUR_PRICE)} labour. Keyboard replacement is ${money(KEYBOARD_PRICE)}, screen replacement ${money(SCREEN_PRICE)} and motherboard issues ${money(MOTHERBOARD_PRICE)}. Parts, shipping and applicable taxes are quoted separately.` },
  { q: 'Do you offer free pickup?', a: `Yes. Pickup and return delivery are free within our London, Ontario service area, currently up to ${serviceArea.radiusKm} km. Enter your postal code in the repair request and we will confirm your address is covered.` },
  { q: 'How long does a repair take?', a: policies.turnaround },
  { q: 'Are replacement parts included?', a: 'No. Our listed prices are labour only. Parts, shipping and applicable taxes are additional, and every part cost appears on your quotation before you approve the repair.' },
  { q: 'Do you provide warranties?', a: policies.warranty },
  { q: 'What happens if I decline the repair?', a: 'Nothing else is charged. Your device is returned and only the diagnostic fee applies. We never start a repair without your approval.' },
  { q: 'Do you repair MacBooks?', a: policies.macbook },
  { q: 'Do you replace MacBook batteries?', a: `Yes. MacBook battery replacement is ${money(MACBOOK_BATTERY_PRICE)} labour, plus the cost of the battery for your model. Tell us your MacBook model in the repair request and we confirm the battery and the total in your quotation.` },
  { q: 'Can I request a specific repair?', a: 'Yes. Tell us what you want done, such as a new SSD or a battery replacement, in the problem description. We still diagnose the device first so the quotation reflects what it actually needs.' },
  { q: 'Are you responsible for the data on my device?', a: policies.dataDisclaimer },
  { q: 'What areas do you serve?', a: `We serve London, Ontario. Free pickup and delivery covers the service area within ${serviceArea.radiusKm} km. We do not offer pickup outside that area.` },
];

/* ------------------------------ NAVIGATION --------------------------- */

export const nav = [
  { href: '/computer-repair-london', label: 'Services' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;

export const footerServices = [
  { href: '/computer-repair-london', label: 'Computer repair' },
  { href: '/laptop-repair-london', label: 'Laptop repair' },
  { href: '/macbook-repair-london', label: 'MacBook repair' },
  { href: '/pricing', label: 'Pricing' },
] as const;

export const BOOK_HREF = '/contact#book';

/** All indexable page paths (used by the sitemap). */
export const sitemapPaths = [
  '/',
  '/computer-repair-london',
  '/laptop-repair-london',
  '/macbook-repair-london',
  '/pricing',
  '/about',
  '/contact',
  '/privacy-policy',
] as const;
