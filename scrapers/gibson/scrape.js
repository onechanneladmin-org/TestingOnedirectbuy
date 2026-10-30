#!/usr/bin/env node
'use strict';

/**
 * Gibson Performance Exhaust product scraper (https://gibsonperformance.com/).
 *
 *   node scrapers/gibson/scrape.js --sample            # 7-MPN validation run
 *   node scrapers/gibson/scrape.js                     # every MPN in gibson_mpns.json
 *   node scrapers/gibson/scrape.js 619001 69553-B      # specific MPNs
 *   node scrapers/gibson/scrape.js --file list.txt     # .json array or one MPN per line
 *
 * Options: --out <xlsx>  --workers <n>  --search box|url  --fresh  --retry-failed  --no-revalidate
 *          --no-inspect  --headed
 *
 * For every MPN: search the site, open only result cards whose PART # equals the
 * MPN, confirm the product page's Item # equals the MPN, extract the page, check
 * its images load, then re-open the page and compare the extracted values.
 * Progress is saved to output/progress.jsonl, so an interrupted run resumes.
 */

const fs = require('fs');
const path = require('path');
const { SAMPLE_MPNS, OUTPUT_DIR, DEFAULT_MPN_FILE, DELAY_MS } = require('./lib/config');
const { searchMpn, inspectSite, goto, isProductUrl } = require('./lib/search');
const { expandProductSections, verifyImagesInPage, collectPageData, buildProduct, isAutomotivePage } = require('./lib/extract');
const { writeWorkbook } = require('./lib/excel');

function loadPlaywright() {
  try {
    return require('@playwright/test');
  } catch {
    return require('playwright');
  }
}

function readMpnFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (/^\s*\[/.test(text)) return JSON.parse(text).map(String);
  return text.split(/\r?\n/).map((s) => s.split('#')[0].trim()).filter(Boolean);
}

function parseArgs(argv) {
  const opts = { mpns: [], headed: false, inspect: true, revalidate: true, fresh: false, workers: 3, search: '', out: path.join(OUTPUT_DIR, 'gibson_products.xlsx') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') opts.mpns.push(...readMpnFile(argv[++i]));
    else if (a === '--sample') opts.mpns.push(...SAMPLE_MPNS);
    else if (a === '--headed') opts.headed = true;
    else if (a === '--no-inspect') opts.inspect = false;
    else if (a === '--no-revalidate') opts.revalidate = false;
    else if (a === '--fresh') opts.fresh = true;
    else if (a === '--retry-failed') opts.retryFailed = true;
    else if (a === '--workers') opts.workers = Math.max(1, Number(argv[++i]) || 1);
    else if (a === '--search') opts.search = argv[++i];
    else if (a === '--out') opts.out = path.resolve(argv[++i]);
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
      process.exit(0);
    } else opts.mpns.push(a);
  }
  if (!opts.mpns.length) opts.mpns = readMpnFile(DEFAULT_MPN_FILE);
  opts.mpns = [...new Set(opts.mpns.map((s) => s.trim()).filter(Boolean))];
  // Typing into the search box costs a home-page load per MPN; for big lists the
  // same results page is opened directly (it is exactly what the box submits to).
  if (!opts.search) opts.search = opts.mpns.length <= 25 ? 'box' : 'url';
  return opts;
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const firstLine = (err) => String((err && err.message) || err).split('\n')[0];

async function openProduct(page, url) {
  const res = await goto(page, url);
  await expandProductSections(page);
  const raw = await page.evaluate(collectPageData);
  return { raw, status: res ? res.status() : null };
}

async function verifyImages(page, images) {
  const results = await verifyImagesInPage(page, images.map((i) => i['Image URL']));
  images.forEach((img, i) => {
    const r = results[i];
    img['HTTP Status'] = r.status || '';
    img['Content Type'] = r.type;
    img.Verified = r.ok && /^image\//i.test(r.type) ? 'Yes' : `No${r.error ? ` (${r.error})` : ''}`;
  });
}

const COMPARED = ['MPN', 'Product Name', 'UPC', 'Tubing Diameter (as listed)', 'Tip Specification', 'Muffler Description', 'Exit Position', 'Warranty', 'Product Category', 'Fitment Count', 'Image Count'];

// Opens the product page again in a fresh tab and compares every key value.
async function revalidate(context, product, mpn) {
  const page = await context.newPage();
  try {
    const { raw, status } = await openProduct(page, product['Product URL']);
    const again = buildProduct(raw, mpn, { method: '', searchUrl: '', resultCount: 0 }).product;
    const notes = [];
    if (status !== 200) notes.push(`page status ${status} on re-open`);
    for (const c of COMPARED) if (String(again[c]) !== String(product[c])) notes.push(`${c} differs on re-open`);
    return { status, notes };
  } catch (err) {
    return { status: null, notes: [`re-open failed: ${firstLine(err)}`] };
  } finally {
    await page.close();
  }
}

async function scrapeMpn(context, page, mpn, opts) {
  const search = await searchMpn(page, mpn, opts.search);
  const checked = [];
  const matches = [];

  for (const card of search.candidates) {
    let opened;
    try {
      opened = await openProduct(page, card.href);
    } catch (err) {
      checked.push(`${card.href} (open failed: ${firstLine(err)})`);
      continue;
    }
    const { raw, status } = opened;
    if (!isAutomotivePage(raw)) {
      checked.push(`${raw.url} (not an exhaust product page)`);
      continue;
    }
    const built = buildProduct(raw, mpn, search);
    if (!built.mpnCheck.verified) {
      checked.push(`${raw.url} (page states ${built.mpnCheck.partNumbersOnPage || 'no part number'})`);
      continue;
    }
    built.product['HTTP Status'] = status;
    matches.push(built);
  }

  if (!matches.length) {
    const returned = search.cards.map((c) => c.partNumber || '?').join(', ');
    return {
      ok: false,
      search,
      checked,
      reason: !search.cards.length
        ? 'Site search returned no products'
        : !search.candidates.length
          ? `Search returned ${search.cards.length} product(s) but none has PART # ${mpn} (returned: ${returned})`
          : 'Result card matched but the product page Item # does not equal the MPN',
    };
  }

  // Two pages stating the same Item # are never merged: the first is used and the rest are reported.
  const chosen = matches[0];
  chosen.product['Validation Notes Pre'] = [
    ...chosen.mpnCheck.notes,
    matches.length > 1 ? `Also stated on: ${matches.slice(1).map((m) => m.product['Product URL']).join(', ')}` : '',
  ].filter(Boolean);
  return { ok: true, ...chosen, search, checked };
}

function loadProgress(file) {
  const done = new Map();
  if (!fs.existsSync(file)) return done;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      done.set(rec.mpn, rec);
    } catch {
      // A line cut off by a crash is ignored; that MPN is scraped again.
    }
  }
  return done;
}

async function launchBrowser(chromium, headed) {
  try {
    return await chromium.launch({ headless: !headed });
  } catch (err) {
    // Cloud containers ship one pre-installed Chromium outside Playwright's cache.
    if (fs.existsSync('/opt/pw-browsers/chromium')) return chromium.launch({ headless: !headed, executablePath: '/opt/pw-browsers/chromium' });
    throw err;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = path.dirname(opts.out);
  fs.mkdirSync(outDir, { recursive: true });
  const progressFile = path.join(outDir, 'progress.jsonl');
  if (opts.fresh && fs.existsSync(progressFile)) fs.unlinkSync(progressFile);
  const done = loadProgress(progressFile);
  if (opts.retryFailed) for (const [mpn, rec] of done) if (!rec.ok) done.delete(mpn);
  const todo = opts.mpns.filter((m) => !done.has(m));
  log(`${opts.mpns.length} MPNs (${opts.mpns.length - todo.length} already done, ${todo.length} to scrape), search: ${opts.search}, workers: ${opts.workers}`);

  const { chromium } = loadPlaywright();
  const browser = await launchBrowser(chromium, opts.headed);
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    viewport: { width: 1440, height: 1000 },
    locale: 'en-US',
  });
  // Third-party widgets (chat, PayPal, analytics) only slow page loads down.
  await context.route(/livehelpnow|paypal|google-analytics|googletagmanager|facebook|doubleclick|hotjar|shopperapproved|trustguard|wurfl|translate\.google/i, (r) => r.abort());

  const started = Date.now();
  let inspection = null;
  const inspectionFile = path.join(outDir, 'site-inspection.json');

  try {
    if (opts.inspect) {
      const page = await context.newPage();
      log('Inspecting site structure (home page, search widget, categories)...');
      try {
        inspection = await inspectSite(page);
        fs.writeFileSync(inspectionFile, JSON.stringify(inspection, null, 2));
        log(`  search: ${JSON.stringify(inspection.search)}`);
        log(`  categories on home: ${inspection.categoryLinksOnHome}; URL shapes: ${Object.keys(inspection.urlPatterns).slice(0, 6).join(' ')}`);
      } catch (err) {
        log(`  inspection failed: ${firstLine(err)}`);
      }
      await page.close();
    } else if (fs.existsSync(inspectionFile)) {
      inspection = JSON.parse(fs.readFileSync(inspectionFile, 'utf8'));
    }

    const queue = todo.slice();
    let finished = 0;
    const out = fs.openSync(progressFile, 'a');
    const worker = async () => {
      const page = await context.newPage();
      while (queue.length) {
        const mpn = queue.shift();
        let rec;
        try {
          const r = await scrapeMpn(context, page, mpn, opts);
          if (!r.ok) {
            rec = { mpn, ok: false, failed: {
              'Input MPN': mpn, Reason: r.reason, 'Search Method': r.search.method, 'Search URL': r.search.searchUrl,
              'Search Results Found': r.search.resultCount, 'Returned Part Numbers': r.search.cards.map((c) => c.partNumber).join(', '),
              'Candidates Checked': r.checked.length, 'Candidate URLs': r.checked.join('\n'), Error: '', 'Failed At': new Date().toISOString(),
            } };
          } else {
            await verifyImages(page, r.images);
            const notes = [...r.product['Validation Notes Pre']];
            delete r.product['Validation Notes Pre'];
            if (opts.revalidate) {
              const v = await revalidate(context, r.product, mpn);
              notes.push(...v.notes);
              r.product['URL Verified'] = v.status === 200 ? 'Yes' : `No (${v.status})`;
            } else {
              r.product['URL Verified'] = r.product['HTTP Status'] === 200 ? 'Yes' : `No (${r.product['HTTP Status']})`;
            }
            if (!isProductUrl(r.product['Product URL'])) notes.push('URL is not a /i-<id> product page');
            const okImgs = r.images.filter((i) => i.Verified === 'Yes').length;
            if (!r.images.length) notes.push('no product images on page');
            else if (okImgs < r.images.length) notes.push(`${r.images.length - okImgs} image(s) did not load`);
            r.product['Images Verified'] = `${okImgs}/${r.images.length}`;
            r.product['Validation Status'] = notes.length ? 'Check' : 'Passed';
            r.product['Validation Notes'] = notes.join('\n');
            rec = { mpn, ok: true, product: r.product, fitment: r.fitment, images: r.images };
          }
        } catch (err) {
          rec = { mpn, ok: false, failed: { 'Input MPN': mpn, Reason: 'Error during scrape', Error: firstLine(err), 'Failed At': new Date().toISOString() } };
        }
        fs.writeSync(out, `${JSON.stringify(rec)}\n`);
        done.set(mpn, rec);
        finished++;
        log(`[${finished}/${todo.length}] ${mpn}: ${rec.ok ? `OK ${rec.product['Validation Status']} | fitment ${rec.fitment.length} | images ${rec.product['Images Verified']} | ${rec.product['Product URL']}` : `FAILED ${rec.failed.Reason}`}`);
        await page.waitForTimeout(DELAY_MS);
      }
      await page.close();
    };
    await Promise.all(Array.from({ length: Math.min(opts.workers, todo.length || 1) }, worker));
    fs.closeSync(out);
  } finally {
    await browser.close();
  }

  // Build the workbook from every MPN asked for in this run, in input order.
  const products = [];
  const fitment = [];
  const images = [];
  const failed = [];
  for (const mpn of opts.mpns) {
    const rec = done.get(mpn);
    if (!rec) continue;
    if (rec.ok) {
      products.push(rec.product);
      fitment.push(...rec.fitment);
      images.push(...rec.images);
    } else failed.push(rec.failed);
  }

  // Never merge products: one page may only be the answer for one MPN.
  const owners = new Map();
  for (const p of products) owners.set(p['Product URL'].split('?')[0], [...(owners.get(p['Product URL'].split('?')[0]) || []), p['Input MPN']]);
  for (const p of products) {
    const o = owners.get(p['Product URL'].split('?')[0]);
    if (o.length > 1) {
      p['Validation Status'] = 'Check';
      p['Validation Notes'] = [p['Validation Notes'], `same page also returned for: ${o.filter((x) => x !== p['Input MPN']).join(', ')}`].filter(Boolean).join('\n');
    }
  }

  const reasons = {};
  for (const f of failed) {
    const k = String(f.Reason).replace(/\(returned:.*\)/, '').replace(/\d+ product\(s\)/, 'N product(s)').replace(/PART # \S+/, 'PART # <MPN>');
    reasons[k] = (reasons[k] || 0) + 1;
  }
  const summary = [
    { Metric: 'Website', Value: 'https://gibsonperformance.com/' },
    { Metric: 'Workbook written', Value: new Date().toISOString() },
    { Metric: 'This run duration (s)', Value: Math.round((Date.now() - started) / 1000) },
    { Metric: 'MPNs requested', Value: opts.mpns.length },
    { Metric: 'Products found (Item # = MPN)', Value: products.length },
    { Metric: 'Products failed', Value: failed.length },
    { Metric: 'Success rate', Value: opts.mpns.length ? `${((products.length / opts.mpns.length) * 100).toFixed(1)}%` : '' },
    { Metric: 'Validation passed', Value: products.filter((p) => p['Validation Status'] === 'Passed').length },
    { Metric: 'Validation needs check', Value: products.filter((p) => p['Validation Status'] !== 'Passed').length },
    { Metric: 'Products with fitment', Value: products.filter((p) => p['Fitment Count'] > 0).length },
    { Metric: 'Vehicle fitment rows', Value: fitment.length },
    { Metric: 'Product images', Value: images.length },
    { Metric: 'Images verified (HTTP 200, image/*)', Value: images.filter((i) => i.Verified === 'Yes').length },
    { Metric: 'Products with instructions', Value: products.filter((p) => p['Installation Instructions']).length },
    { Metric: 'Failure reasons', Value: Object.entries(reasons).map(([k, v]) => `${v} × ${k}`).join('\n') },
    { Metric: 'Search method', Value: opts.search === 'box' ? 'Header search box (PartsLogic) → /search.html?q=' : '/search.html?q=<MPN>&orientation=vertical (the page the search box submits to)' },
    { Metric: 'Search widget', Value: inspection ? JSON.stringify(inspection.search) : '' },
    { Metric: 'URL structure', Value: inspection ? Object.entries(inspection.urlLegend || {}).map(([k, v]) => `${k} = ${v}`).join('\n') : '' },
    { Metric: 'Category pages inspected', Value: inspection ? inspection.categoryPages.map((c) => `${c.label || ''} ${c.url} (${c.productLinks ?? 'error'} product links)`).join('\n') : '' },
    { Metric: 'Failed MPNs', Value: failed.map((f) => f['Input MPN']).join(', ') },
  ];

  await writeWorkbook(opts.out, { products, fitment, images, failed, summary });
  fs.writeFileSync(path.join(outDir, 'gibson_products.json'), JSON.stringify({ products, fitment, images, failed, summary }, null, 2));
  log(`Wrote ${opts.out}`);
  log(`Products ${products.length}/${opts.mpns.length}, failed ${failed.length}, fitment rows ${fitment.length}, images ${images.length}`);
  if (!products.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
