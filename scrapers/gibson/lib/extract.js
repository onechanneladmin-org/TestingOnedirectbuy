'use strict';

/**
 * Product-page extraction for gibsonperformance.com (Web Shop Manager product
 * template). `collectPageData` runs in the browser and only reads what the page
 * shows; `buildProduct` maps it to the output columns. Nothing is guessed: a
 * column stays empty when the page does not state it, and every derived value
 * (e.g. Inlet Diameter) is cut from a labelled value on the same page.
 *
 * Page anatomy (inspected live):
 *   h1.wsm-prod-title                       "<name> | <part #>"
 *   .wsm-prod-sku[itemprop=sku]             Item # (the MPN)
 *   .wsm-prod-summary                       short description
 *   #wsm-prod-tab-decrip li label+span      Tubing Diameter, Tip Description, Tip Specification,
 *                                           Muffler Description/Dimension, Header Features, Exit Position,
 *                                           Footnote, Series, System Type, Warranty, Item #
 *   #wsm-prod-tab-details li                SKU, UPC # (its itemprop is wrongly "mpn"), Brand, Condition,
 *                                           "Year Make Model Submodel" fitment links, Categories, Product Series
 *   #wsm-prod-tab-1                         Application List (same fitment links, older items)
 *   #wsm-prod-tab-shipping li               Weight, Package Dimensions, Shipping Remarks
 *   #wsm-prod-tab-docs a                    instruction PDFs (/pdf/<id>)
 *   #wsm-prod-images-container a[href*=/images/F...]  full-size images
 *   pager "« Prev | Main | Next »"             Main = the product's category page
 */

/* eslint-disable no-undef */
function collectPageData() {
  const clean = (s) => String(s == null ? '' : s).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  const oneLine = (s) => clean(s).replace(/\s*\n\s*/g, ' ');
  const abs = (u) => {
    try { return new URL(u, location.href).href; } catch { return ''; }
  };
  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const h1 = q('h1.wsm-prod-title') || q('h1');
  const title = oneLine(h1 && h1.textContent);

  // label/value pairs from every product tab, in page order, with the tab they came from.
  const specs = [];
  const fitmentLinks = [];
  for (const li of qa('[id^="wsm-prod-tab"] li, .wsm-prod-summary li, .wsm_product_info_itemid')) {
    if (li.style.display === 'none') continue;
    const label = li.querySelector('label');
    if (!label) continue;
    const name = oneLine(label.textContent).replace(/[:：]\s*$/, '');
    const tab = (li.closest('[id^="wsm-prod-tab"]') || {}).id || 'summary';
    if (/^Year Make Model/i.test(name)) {
      const a = li.querySelector('a');
      const lines = (a || li).textContent.split('\n').map((s) => s.trim()).filter(Boolean);
      // Without an <a>, the label text itself is in textContent: drop it.
      if (!a && lines.length && /^Year Make Model/i.test(lines[0])) lines.shift();
      if (lines.length) fitmentLinks.push({ fields: name.split(/\s+/), lines, text: oneLine(lines.join(' ')), url: a ? a.href : '', tab });
      continue;
    }
    const value = oneLine(li.textContent.replace(label.textContent, ''));
    if (name && value) specs.push({ label: name, value, tab });
  }
  // The Item # block next to the price is not an <li>.
  const sku = q('.wsm-prod-sku, [itemprop="sku"]');
  if (sku && !specs.some((s) => s.label === 'Item #' && s.value === oneLine(sku.textContent))) {
    specs.unshift({ label: 'Item #', value: oneLine(sku.textContent), tab: 'price box' });
  }

  const listUnder = (heading) => {
    const h = qa('.wsm-prod-cat-list h2, h2').find((x) => oneLine(x.textContent) === heading);
    if (!h) return [];
    return qa('li, a', h.parentElement)
      .filter((el) => el.tagName === 'LI' ? el.style.display !== 'none' : !el.closest('li'))
      .map((el) => oneLine(el.textContent))
      .filter((t, i, arr) => t && arr.indexOf(t) === i);
  };

  const summaryEl = q('.wsm-prod-summary');
  let summary = '';
  if (summaryEl) {
    const copy = summaryEl.cloneNode(true);
    copy.querySelectorAll('li[style*="display: none"], li[style*="display:none"]').forEach((n) => n.remove());
    summary = clean(copy.innerText || copy.textContent);
  }

  // Full-size images: F<id>.jpg links in the product image container, in page order.
  const images = [];
  const seen = new Set();
  const container = q('#wsm-prod-images-container') || q('#wsm-prod-rotate-image');
  if (container) {
    for (const a of qa('a[href]', container)) {
      const href = abs(a.getAttribute('href'));
      if (!/\/images\//i.test(href) || seen.has(href)) continue;
      seen.add(href);
      const img = a.querySelector('img');
      images.push({ url: href, alt: oneLine((img && img.getAttribute('alt')) || a.getAttribute('title') || ''), thumb: img ? abs(img.getAttribute('src')) : '' });
    }
    if (!images.length) {
      for (const img of qa('img[itemprop="image"], img', container)) {
        const src = abs(img.getAttribute('src'));
        if (src && !seen.has(src)) { seen.add(src); images.push({ url: src, alt: oneLine(img.getAttribute('alt')), thumb: '' }); }
      }
    }
  }

  const documents = qa('#wsm-prod-tab-docs a[href]').map((a) => ({ url: abs(a.getAttribute('href')), text: oneLine(a.textContent || a.getAttribute('title')) }));

  const price = (sel) => {
    const el = q(sel);
    return el ? oneLine(el.textContent) : '';
  };
  const priceBox = qa('#wsm-prod-info [class*="price" i] span, .wsm-prod-price span').map((s) => oneLine(s.textContent));

  return {
    url: location.href,
    canonical: (q('link[rel="canonical"]') || {}).href || '',
    pageTitle: document.title,
    title,
    summary,
    specs,
    fitmentLinks,
    categories: listUnder('Categories'),
    // The Prev / Main / Next pager links "Main" to the product's own category; its
    // title is "<category> - <product title>". The Categories block above is
    // sometimes rendered empty by the site, this link is always present.
    mainCategory: (() => {
      const a = qa('a[href]').find((x) => oneLine(x.textContent) === 'Main' && /\/c-\d+-/.test(x.getAttribute('href')));
      return a ? { name: oneLine(a.getAttribute('title')).split(' - ')[0], url: abs(a.getAttribute('href')) } : null;
    })(),
    series: listUnder('Product Series'),
    images,
    documents,
    microdata: {
      sku: sku ? oneLine(sku.textContent) : '',
      brand: oneLine((q('[itemprop="brand"]') || {}).textContent),
      price: price('[itemprop="offers"] [itemprop="price"]'),
      currency: price('[itemprop="offers"] [itemprop="priceCurrency"]'),
      availability: ((q('[itemprop="offers"] [itemprop="availability"]') || {}).href || '').replace(/^.*\//, ''),
      condition: price('[itemprop="itemcondition"]'),
    },
    priceBox,
    isProductPage: !!(q('#wsm-prod-info-container') || q('.wsm-prod-sku') || q('h1.wsm-prod-title')),
    bodyText: clean(document.body ? document.body.innerText : '').slice(0, 8000),
  };
}
/* eslint-enable no-undef */

async function expandProductSections(page) {
  // All tabs are in the DOM (hidden with display:none), so nothing needs clicking,
  // but /i-<id> links redirect to the slug URL: wait for the final page to finish.
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  await page.waitForSelector('footer', { state: 'attached', timeout: 15000 }).catch(() => {});
  await page.waitForSelector('h1, .wsm-prod-sku', { timeout: 15000 }).catch(() => {});
}

// Checks each image from inside the product page (same origin, same network path as the browser).
async function verifyImagesInPage(page, urls) {
  return page.evaluate(async (list) => Promise.all(list.map(async (url) => {
    const probe = async (method) => {
      const r = await fetch(url, { method, cache: 'no-store' });
      return { status: r.status, type: r.headers.get('content-type') || '', bytes: Number(r.headers.get('content-length')) || 0, ok: r.ok };
    };
    try {
      let r = await probe('HEAD');
      if (!r.ok || !/^image\//i.test(r.type)) r = await probe('GET');
      return { url, ...r, error: '' };
    } catch (err) {
      return { url, status: 0, type: '', bytes: 0, ok: false, error: String(err && err.message) };
    }
  })), urls);
}

// ---------------- Node-side mapping ----------------

const norm = (s) => String(s == null ? '' : s).trim();
const normMpn = (s) => norm(s).toUpperCase().replace(/\s+/g, '');
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

function specMap(specs) {
  const m = new Map();
  for (const s of specs) {
    const k = s.label.toLowerCase();
    if (!m.has(k)) m.set(k, []);
    if (!m.get(k).includes(s.value)) m.get(k).push(s.value);
  }
  return m;
}
const get = (m, ...labels) => {
  for (const l of labels) {
    const v = m.get(l.toLowerCase());
    if (v && v.length) return v.join(' | ');
  }
  return '';
};

// Every distinct phrase matching `re`, dropping ones contained in a longer match ("Stainless" vs "409 Stainless").
function findAll(text, re) {
  const found = uniq((String(text).match(re) || []).map((s) => s.replace(/\s+/g, ' ').trim()));
  const seen = new Map();
  for (const f of found) if (!seen.has(f.toLowerCase())) seen.set(f.toLowerCase(), f);
  const all = [...seen.values()];
  return all.filter((f) => !all.some((o) => o !== f && o.toLowerCase().includes(f.toLowerCase())));
}

// The part number that ends the product title: "... | 619001" or "... | #500361".
function titlePartNumber(title) {
  const m = String(title).match(/\|\s*#?\s*([A-Z0-9][A-Z0-9.\-/]*)\s*$/i);
  return m ? m[1] : '';
}

function verifyMpn(raw, mpn) {
  const target = normMpn(mpn);
  const m = specMap(raw.specs);
  const itemNos = uniq([...(m.get('item #') || []), raw.microdata.sku]);
  const skus = m.get('sku') || [];
  const titlePn = titlePartNumber(raw.title);
  const itemMatch = itemNos.some((v) => normMpn(v) === target);
  const skuMatch = skus.some((v) => normMpn(v) === target);
  const titleMatch = normMpn(titlePn) === target;
  const sources = [
    ...itemNos.map((v) => `Item # ${v}`),
    ...skus.map((v) => `SKU ${v}`),
    titlePn ? `Title ${titlePn}` : '',
  ].filter(Boolean);
  const notes = [];
  if (itemMatch && titlePn && !titleMatch) notes.push(`Title ends with "${titlePn}" but Item # is ${itemNos.join(', ')}`);
  if (itemMatch && skus.length && !skuMatch) notes.push(`SKU ${skus.join(', ')} differs from Item #`);
  return {
    // The Item # (part number field) is authoritative; the title suffix alone is not enough.
    verified: itemMatch || (!itemNos.length && skuMatch),
    matchedValue: itemMatch ? itemNos.find((v) => normMpn(v) === target) : skuMatch ? skus.find((v) => normMpn(v) === target) : '',
    matchedSource: itemMatch ? 'Item #' : skuMatch ? 'SKU' : '',
    partNumbersOnPage: sources.join('; '),
    notes,
  };
}

function isAutomotivePage(raw) {
  const text = `${raw.title} ${raw.summary} ${raw.categories.join(' ')}`.toLowerCase();
  const guitar = /\bguitar|fretboard|humbucker|les paul|\bukulele|\bbanjo/.test(text);
  return raw.isProductPage && !guitar;
}

// Splits the site's "Submodel" value ("5.2L, Supercrew, Short Bed") into its stated parts.
function splitSubmodel(sub) {
  const out = { engine: [], cab: [], bed: [], drive: [], body: [], rest: [] };
  for (const part of String(sub).split(/\s*,\s*/).filter(Boolean)) {
    if (/\b\d\.\d\s*L\b|\b\d{3}\s*(ci|cid)\b|\bV-?\d{1,2}\b|\bdiesel\b|\bhemi\b|\bturbo\b|\becoboost\b|\bpower\s*stroke\b|\bduramax\b|\bcummins\b|\bcc\b|\d{3,4}\s*cc/i.test(part)) out.engine.push(part);
    else if (/\bcab\b|crew|super\s*cab|supercrew|quad|double|extended|regular|mega/i.test(part)) out.cab.push(part);
    else if (/\bbed\b/i.test(part)) out.bed.push(part);
    else if (/\b(2|4)wd\b|\bawd\b|\brwd\b|\bfwd\b|4x4|4x2/i.test(part)) out.drive.push(part);
    else if (/\b\d\s*-?\s*door\b|\bdr\b|\bsedan\b|\bcoupe\b|\bconvertible\b|\bhatchback\b|\bwagon\b/i.test(part)) out.body.push(part);
    else out.rest.push(part);
  }
  return out;
}

function fitmentRows(raw, mpn, productUrl) {
  const rows = [];
  const seen = new Set();
  for (const f of raw.fitmentLinks) {
    if (seen.has(f.text)) continue; // the same list is shown in two tabs on some items
    seen.add(f.text);
    // Map the label's words (Year Make Model Submodel ...) onto the link's lines.
    const byField = {};
    if (f.lines.length === f.fields.length) f.fields.forEach((field, i) => { byField[field] = f.lines[i]; });
    const sub = byField.Submodel || '';
    const parts = splitSubmodel(sub);
    rows.push({
      MPN: mpn,
      'Product URL': productUrl,
      Year: byField.Year || '',
      Make: byField.Make || '',
      Model: byField.Model || '',
      Submodel: sub,
      Engine: byField.Engine || parts.engine.join(', '),
      'Cab Configuration': parts.cab.join(', '),
      'Bed Length': parts.bed.join(', '),
      'Drive Type': parts.drive.join(', '),
      Body: parts.body.join(', '),
      'Submodel Other': parts.rest.join(', '),
      'Fitment Text': f.text,
      'Fitment Page URL': f.url,
      Source: `${f.fields.join(' ')} (${f.tab})`,
    });
  }
  return rows;
}

const MATERIAL_RE = /\b(?:T?-?\d{3}\s+)?(?:stainless(?:\s+steel)?|aluminized(?:\s+steel)?|mild\s+steel|titanium|carbon\s+fiber|aluminum)\b/gi;
const FINISH_RE = /\b(?:polished|black\s+ceramic(?:[- ]coated)?|ceramic[- ]coated|ceramic|black\s+elite|brushed|chrome|satin|powder[- ]coated|black\s+(?:powder\s+)?coated|matte\s+black|stealth\s+black)\b/gi;
const EXHAUST_TYPE_RE = /\b(?:cat[- ]back|axle[- ]back|header[- ]back|turbo[- ]back|down[- ]?pipe[- ]back|dpf[- ]back|single\s+exit|exhaust\s+tips?|tips?|mufflers?|headers?|y[- ]pipe|x[- ]pipe|mid[- ]pipe|tail\s*pipe|resonator|slip[- ]on|full\s+system)\b/i;
const CONFIG_RE = /\b(?:dual\s+(?:split\s+(?:rear|side)|split|sport|extreme|rear|side|exit)|single\s+(?:side|rear|exit|straight|turn[- ]down)|dual|single|split\s+rear|x[- ]exhaust|dual[- ]tip|triple|quad)\b/i;

function buildProduct(raw, mpn, searchInfo) {
  const m = specMap(raw.specs);
  const mpnCheck = verifyMpn(raw, mpn);
  const fitment = fitmentRows(raw, mpn, raw.url);
  const fromFit = (col) => uniq(fitment.map((f) => f[col])).join(' | ');

  const tubing = get(m, 'Tubing Diameter');
  const tipDesc = get(m, 'Tip Description');
  const tipSpec = get(m, 'Tip Specification');
  const mufflerDesc = get(m, 'Muffler Description');
  const mufflerDim = get(m, 'Muffler Dimension');
  const headerFeat = get(m, 'Header Features');
  const addl = get(m, 'Additional Description');
  const systemType = get(m, 'System Type', 'Exhaust Type', 'Type');
  const name = raw.title.replace(/\s*\|\s*#?\s*[A-Z0-9][A-Z0-9.\-/]*\s*$/i, '').trim();
  const specText = [tubing, tipDesc, tipSpec, mufflerDesc, mufflerDim, headerFeat, addl].join(' ; ');

  const inlet = (tipSpec.match(/inlet\s*([\d.]+\s*(?:in\.?|")?)/i) || [])[1] || (name.match(/([\d.]+)[- ]inch\s+inlet/i) || [])[1];
  const outlet = (tipSpec.match(/outlet\s*([\d.]+\s*(?:in\.?|")?)/i) || [])[1] || (name.match(/([\d.]+)[- ]inch\s+outlet/i) || [])[1];
  const pipe = (tubing.match(/^\s*([\d.]+\s*-?\s*(?:in\.?|inch|")?)/i) || [])[1];
  const sound = get(m, 'Sound', 'Sound Level', 'Tone') || findAll(mufflerDesc, /[^,;.]*\b(?:sound|tone|drone|rumble)\b[^,;.]*/gi).join('; ');
  const install = get(m, 'Installation Type') || uniq([
    /bolt[- ]on/i.test(`${addl} ${headerFeat} ${raw.summary}`) ? 'Bolt-On' : '',
    /no\s+welding|no\s+cutting/i.test(`${headerFeat} ${raw.summary}`) ? 'No Welding' : '',
    /\bweld[- ]on\b/i.test(tipDesc) ? 'Tip: Weld On' : '',
    /\bclamp[- ]on\b/i.test(tipDesc) ? 'Tip: Clamp On' : '',
  ]).join('; ');
  const instructionDocs = raw.documents.filter((d) => /instruction|install|manual/i.test(d.text));

  const known = new Set(['footnote', 'condition', 'shipping remarks', 'tubing diameter', 'tip description', 'tip specification', 'muffler description', 'muffler dimension', 'header features', 'additional description', 'exit position', 'warranty', 'item #', 'sku', 'upc #', 'brand', 'system type', 'series', 'weight', 'package dimensions']);

  const product = {
    'Input MPN': mpn,
    MPN: mpnCheck.matchedValue,
    'MPN Verified': mpnCheck.verified ? 'Yes' : 'No',
    'MPN Source': mpnCheck.matchedSource,
    'Product Name': name,
    'Full Title': raw.title,
    Brand: get(m, 'Brand') || raw.microdata.brand,
    'Product URL': raw.url,
    'Canonical URL': raw.canonical,
    'Product Description': raw.summary,
    'Exhaust Type': systemType || ((name.match(EXHAUST_TYPE_RE) || [])[0] || ''),
    'Product Category': raw.categories.length ? raw.categories.join(' | ') : (raw.mainCategory ? raw.mainCategory.name : ''),
    'Category URL': raw.mainCategory ? raw.mainCategory.url : '',
    'Product Series': uniq([get(m, 'Series'), ...raw.series]).join(' | '),
    'Exhaust Configuration': (name.match(CONFIG_RE) || [])[0] || '',
    'Pipe Diameter': pipe ? pipe.trim() : '',
    'Tubing Diameter (as listed)': tubing,
    'Inlet Diameter': inlet ? inlet.trim() : '',
    'Outlet Diameter': outlet ? outlet.trim() : '',
    'Tip Description': tipDesc,
    'Tip Specification': tipSpec,
    'Muffler Description': mufflerDesc,
    'Muffler Dimension': mufflerDim,
    'Header Features': headerFeat,
    'Additional Description': addl,
    Material: get(m, 'Material') || findAll(`${specText} ${name}`, MATERIAL_RE).join(', '),
    Finish: get(m, 'Finish') || findAll(`${tipDesc} ${name}`, FINISH_RE).join(', '),
    Color: get(m, 'Color', 'Colour'),
    'Sound Level / Sound Type': sound,
    'Installation Type': install,
    'Installation Instructions': instructionDocs.map((d) => d.url).join('\n'),
    'Vehicle Year': fromFit('Year'),
    'Vehicle Make': fromFit('Make'),
    'Vehicle Model': fromFit('Model'),
    'Vehicle Submodel': fromFit('Submodel'),
    Engine: fromFit('Engine'),
    'Cab Configuration': fromFit('Cab Configuration'),
    'Bed Length': fromFit('Bed Length'),
    'Drive Type': fromFit('Drive Type'),
    Position: get(m, 'Exit Position', 'Position'),
    UPC: get(m, 'UPC #', 'UPC'),
    Warranty: get(m, 'Warranty'),
    Footnote: get(m, 'Footnote'),
    Price: raw.microdata.price ? `${raw.microdata.currency || 'USD'} ${raw.microdata.price}` : '',
    'Price Box': raw.priceBox.join(' '),
    Availability: raw.microdata.availability,
    Condition: get(m, 'Condition') || raw.microdata.condition,
    Weight: get(m, 'Weight'),
    'Package Dimensions': get(m, 'Package Dimensions'),
    'Shipping Remarks': get(m, 'Shipping Remarks'),
    'Image Count': raw.images.length,
    'Primary Image': raw.images[0] ? raw.images[0].url : '',
    'Product Documents': raw.documents.map((d) => `${d.text || 'Document'}: ${d.url}`).join('\n'),
    'Fitment Count': fitment.length,
    'Other Specifications': raw.specs.filter((s) => !known.has(s.label.toLowerCase())).map((s) => `${s.label}: ${s.value}`).filter((v, i, a) => a.indexOf(v) === i).join('\n'),
    'Part Numbers On Page': mpnCheck.partNumbersOnPage,
    'Search Method': searchInfo.method,
    'Search URL': searchInfo.searchUrl,
    'Search Results Found': searchInfo.resultCount,
    'Scraped At': new Date().toISOString(),
  };

  const images = raw.images.map((img, i) => ({
    MPN: mpn,
    'Product URL': raw.url,
    'Image #': i + 1,
    'Image URL': img.url,
    'Thumbnail URL': img.thumb,
    'Alt Text': img.alt,
  }));

  return { product, fitment, images, mpnCheck };
}

module.exports = {
  expandProductSections,
  verifyImagesInPage,
  collectPageData,
  buildProduct,
  verifyMpn,
  isAutomotivePage,
  fitmentRows,
  splitSubmodel,
  titlePartNumber,
  normMpn,
};
