'use strict';

const { BASE_URL, ALLOWED_HOSTS, NAV_TIMEOUT_MS } = require('./config');

/**
 * Site search on gibsonperformance.com (inspected live):
 *  - The header holds a PartsLogic search bar (React). Clicking its button opens a
 *    modal with input#sui-search-bar-input; submitting it navigates to
 *    /search.html?q=<text> (the page's own redirect handler).
 *  - /search.html renders results client-side as section.Sui-ProductListItem--root
 *    cards with title, "PART #: <mpn>" (.Sui-ProductListItem--dealerid) and
 *    "SKU: BFBL-<mpn>" (.Sui-ProductListItem--stockid); links go to /i-<itemId>.
 *  - No match renders "No results for your current search..." in .searchPage-module_noResults.
 */

const PRODUCT_PATH_RE = /^\/i-\d+(?:-[^/]*\.html)?$/i;

const isOnSite = (url) => {
  try {
    return ALLOWED_HOSTS.includes(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
};
const isProductUrl = (url) => isOnSite(url) && PRODUCT_PATH_RE.test(new URL(url).pathname);
const searchUrl = (mpn) => `${BASE_URL}search.html?q=${encodeURIComponent(mpn)}&orientation=vertical`;

async function goto(page, url, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    } catch (err) {
      lastErr = err;
      await page.waitForTimeout(2000 * i);
    }
  }
  throw lastErr;
}

// Waits until PartsLogic has rendered either result cards or its "no results" text.
async function waitForResults(page) {
  await page.waitForFunction(
    () => document.querySelector('.Sui-ProductListItem--root') ||
      ((document.querySelector('[class*="noResults"]') || {}).innerText || '').trim().length > 0,
    null,
    { timeout: 25000 },
  );
  // Cards can paint before their PART # fills in: wait for every card's part number.
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('.Sui-ProductListItem--root'))
      .every((c) => ((c.querySelector('.Sui-ProductListItem--dealerid') || {}).innerText || '').replace(/PART\s*#\s*:?/i, '').trim()),
    null,
    { timeout: 8000 },
  ).catch(() => {});
  await page.waitForTimeout(300);
}

async function readResultCards(page) {
  return page.$$eval('.Sui-ProductListItem--root', (cards) => cards.map((c) => {
    const t = (sel) => ((c.querySelector(sel) || {}).innerText || '').replace(/\s+/g, ' ').trim();
    const link = c.querySelector('a.Sui-ProductListItem--title') || c.querySelector('a[href]');
    return {
      title: t('.Sui-ProductListItem--title'),
      href: link ? link.href : '',
      partNumber: t('.Sui-ProductListItem--dealerid').replace(/^PART\s*#\s*:\s*/i, ''),
      sku: t('.Sui-ProductListItem--stockid').replace(/^SKU\s*:\s*/i, ''),
      price: t('.Sui-ProductListItem--sale') || t('.Sui-ProductListItem--price'),
    };
  }));
}

// Types the MPN into the site's own search box and submits it.
async function submitSearchBox(page, mpn) {
  await goto(page, BASE_URL);
  const button = page.locator('#pl-search-bar-container .Sui-SearchBar--search-button, .Sui-SearchBar--search-button').first();
  await button.waitFor({ state: 'visible', timeout: 20000 });
  await button.click();
  // The modal's input is the instance with a real size.
  const inputs = page.locator('#sui-search-bar-input');
  let input = null;
  for (let tries = 0; tries < 20 && !input; tries++) {
    const n = await inputs.count();
    for (let i = 0; i < n; i++) {
      const box = await inputs.nth(i).boundingBox();
      if (box && box.width > 50 && box.y >= 0) { input = inputs.nth(i); break; }
    }
    if (!input) await page.waitForTimeout(250);
  }
  if (!input) throw new Error('search box did not open');
  await input.fill(mpn);
  await Promise.all([
    page.waitForURL(/\/search\.html\?/i, { timeout: 20000 }),
    input.press('Enter'),
  ]);
}

/**
 * Searches one MPN. mode "box" uses the header search box like a shopper;
 * mode "url" opens the same /search.html?q= page the box submits to.
 * Returns { method, searchUrl, resultCount, cards, candidates }.
 */
async function searchMpn(page, mpn, mode = 'box') {
  let method = mode === 'box' ? 'site search box' : 'site search URL';
  if (mode === 'box') {
    try {
      await submitSearchBox(page, mpn);
    } catch (err) {
      method = `site search URL (search box failed: ${err.message.split('\n')[0]})`;
      await goto(page, searchUrl(mpn));
    }
  } else {
    await goto(page, searchUrl(mpn));
  }
  await waitForResults(page);
  let cards = (await readResultCards(page)).filter((c) => isProductUrl(c.href));
  // An empty or half-rendered result list is searched once more before it counts as a miss.
  if (!cards.length || cards.some((c) => !c.partNumber)) {
    await goto(page, searchUrl(mpn));
    await waitForResults(page);
    cards = (await readResultCards(page)).filter((c) => isProductUrl(c.href));
    method += ' (searched twice)';
  }

  // The site writes some part numbers with spaces ("70 - 0006"); spaces never change the part.
  const key = (s) => String(s).toUpperCase().replace(/\s+/g, '');
  const exact = cards.filter((c) => key(c.partNumber) === key(mpn));
  // Only cards whose PART # is exactly the MPN are opened; a near match
  // (619633 vs 619633B) is a different product and is never used.
  return { method, searchUrl: page.url(), resultCount: cards.length, cards, candidates: exact };
}

/** Home page, its product menus, the catalog and a few category pages. */
async function inspectSite(page, maxCategories = 4) {
  const report = { baseUrl: BASE_URL, inspectedAt: new Date().toISOString(), search: {}, categoryPages: [], productUrlSamples: [], urlPatterns: {} };
  const res = await goto(page, BASE_URL);
  report.homeStatus = res ? res.status() : null;
  report.homeTitle = await page.title();
  await page.waitForSelector('.Sui-SearchBar--search-button', { timeout: 20000 }).catch(() => {});
  report.search = await page.evaluate(() => {
    const input = document.querySelector('#sui-search-bar-input');
    return {
      widget: window.PartslogicUi ? 'PartsLogic search bar (React)' : 'not detected',
      inputId: input ? input.id : '',
      inputName: input ? input.name : '',
      placeholder: input ? input.placeholder : '',
      submitsTo: '/search.html?q=<query>',
      vehicleSearch: !!document.querySelector('#pl-fitment-selector-container'),
    };
  });

  const links = await page.$$eval('a[href]', (as) => as.map((a) => ({ href: a.href.split('#')[0], text: (a.innerText || a.title || '').trim().slice(0, 80) })));
  const onSite = links.filter((l) => isOnSite(l.href));
  for (const l of onSite) {
    const p = new URL(l.href).pathname;
    const shape = p.replace(/^\/([a-z]+)-[\d.]+(?:-.*)?\.html$/i, '/$1-{id}-{slug}.html').replace(/^\/i-\d+$/, '/i-{id}');
    report.urlPatterns[shape] = (report.urlPatterns[shape] || 0) + 1;
  }
  report.urlPatterns = Object.fromEntries(Object.entries(report.urlPatterns).sort((a, b) => b[1] - a[1]).slice(0, 30));
  report.urlLegend = {
    '/i-{id}-{slug}.html': 'product detail page (WSM item id); /i-{id} redirects to it',
    '/c-{id}-{slug}.html': 'category listing',
    '/p-{id}-{slug}.html': 'content / landing page',
    '/ag-{ids}-{slug}.html': 'vehicle (year.make.model.submodel) attribute listing',
    '/search.html?q=': 'PartsLogic search results',
  };
  const cats = [...new Map(onSite.filter((l) => /^\/c-\d+-/.test(new URL(l.href).pathname)).map((l) => [l.href, l])).values()];
  report.categoryLinksOnHome = cats.length;
  report.productUrlSamples = [...new Set(onSite.filter((l) => isProductUrl(l.href)).map((l) => l.href))].slice(0, 10);

  for (const cat of cats.slice(0, maxCategories)) {
    try {
      await goto(page, cat.href);
      await page.waitForSelector('.Sui-ProductListItem--root, a[href*="/i-"]', { timeout: 15000 }).catch(() => {});
      const products = [...new Set((await page.$$eval('a[href]', (as) => as.map((a) => a.href.split('#')[0]))).filter(isProductUrlBrowserless))];
      report.categoryPages.push({ url: cat.href, label: cat.text, productLinks: products.length, sample: products.slice(0, 5) });
      for (const p of products.slice(0, 3)) if (!report.productUrlSamples.includes(p)) report.productUrlSamples.push(p);
    } catch (err) {
      report.categoryPages.push({ url: cat.href, label: cat.text, error: err.message.split('\n')[0] });
    }
  }
  return report;
}

function isProductUrlBrowserless(u) {
  try {
    const url = new URL(u);
    return ALLOWED_HOSTS.includes(url.hostname) && PRODUCT_PATH_RE.test(url.pathname);
  } catch {
    return false;
  }
}

module.exports = { searchMpn, inspectSite, goto, isProductUrl, isOnSite, searchUrl };
