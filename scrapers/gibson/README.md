# Gibson Performance Exhaust scraper

Node.js + Playwright scraper for automotive exhaust products on
<https://gibsonperformance.com/>. It searches every MPN on the site, opens only the
product page whose **Item #** equals the MPN, extracts the product, verifies it,
and writes `gibson_products.xlsx` with ExcelJS.

It only accepts automotive exhaust product pages on gibsonperformance.com: links
to other hosts, non-product pages and anything mentioning guitars or other
instruments are rejected.

## Run

```bash
npm ci
```

```bash
npm run scrape:gibson:sample        # 7-MPN validation run (fresh)
```

```bash
npm run scrape:gibson               # every MPN in gibson_mpns.json (resumes)
```

```bash
node scrapers/gibson/scrape.js 619001 69553-B GP309S-C --out ./gibson_products.xlsx
```

| Option | Meaning |
| --- | --- |
| `MPN ...` | MPNs on the command line |
| `--file <path>` | JSON array or one MPN per line (`#` comments allowed) |
| `--sample` | the 7 validation MPNs in `lib/config.js` |
| `--out <xlsx>` | workbook path (default `scrapers/gibson/output/gibson_products.xlsx`) |
| `--workers <n>` | parallel browser tabs (default 3) |
| `--search box\|url` | `box` types into the header search box like a shopper; `url` opens `/search.html?q=<MPN>`, the page the box submits to. Default: `box` for up to 25 MPNs, `url` above that |
| `--fresh` | ignore saved progress and start over |
| `--no-revalidate` | skip re-opening each product page for the second check |
| `--no-inspect` | skip the home/category structure inspection |
| `--headed` | show the browser |

Progress is appended to `output/progress.jsonl` after every MPN, so a stopped run
picks up where it left off. The workbook is rebuilt from that file at the end
of each run.

Playwright: the repo already pins `@playwright/test`. Install its browser once with
`npx playwright install chromium` if it is not installed yet.

## How the site works (inspected live)

| What | Where |
| --- | --- |
| Search box | PartsLogic React widget in the header (`#pl-search-bar-container`); its button opens a modal with `input#sui-search-bar-input` |
| Search results | `/search.html?q=<query>`, rendered client-side as `.Sui-ProductListItem--root` cards with `PART #` (`.Sui-ProductListItem--dealerid`) and `SKU: BFBL-<mpn>` |
| No results | `.searchPage-module_noResults…` text "No results for your current search…" |
| Product page | `/i-<itemId>-<slug>.html` (`/i-<itemId>` redirects there) |
| Category page | `/c-<id>-<slug>.html` |
| Vehicle listing | `/ag-<year>.<make>.<model>.<submodel>-<slug>.html` |
| Content pages | `/p-<id>-<slug>.html` |

Product page fields used:

| Field | Source on the page |
| --- | --- |
| MPN | `Item #` (`.wsm-prod-sku`), cross-checked with Details → `SKU` and the title's `\| <part #>` suffix |
| Product Name | `h1.wsm-prod-title`, without the part-number suffix |
| Description | `.wsm-prod-summary` |
| Specs | Product Information tab: Tubing Diameter, Tip Description, Tip Specification, Muffler Description, Muffler Dimension, Header Features, Additional Description, Exit Position, Footnote, Series, System Type, Warranty |
| UPC | Details tab `UPC #` (the site tags it `itemprop="mpn"` by mistake, so microdata is not used for the MPN) |
| Fitment | `Year Make Model Submodel:` links in Details / Application List; one row per link |
| Category | Details → Categories, or the pager's `Main` link when the site renders Categories empty |
| Images | `#wsm-prod-images-container` full-size `/images/F<id>.jpg` links |
| Documents | Instructions tab (`/pdf/<id>`) |
| Shipping | Weight, Package Dimensions, Shipping Remarks |

Derived columns are only cut from text on the same page, never guessed:

- Pipe Diameter: the leading size in `Tubing Diameter`.
- Inlet / Outlet Diameter: from `Tip Specification`, or the name for tips.
- Material / Finish: material and finish words found in the spec text and name.
- Exhaust Type: `System Type`, otherwise the type named in the product name.
- Exhaust Configuration: dual / single / split… as named.
- Sound: `Sound`/`Tone` phrases in Muffler Description.
- Installation Type: bolt-on / no-welding / clamp-on / weld-on as stated.
- Engine / Cab / Bed / Drive: the comma parts of each fitment `Submodel` (e.g. `5.3L, Crew Cab, Standard Bed`).

The site does not publish Color, Drive Type or a sound level in dB for most items,
so those stay empty unless a page states them.

## Matching and validation

1. Search the MPN. Only result cards whose `PART #` equals the MPN (spaces
   ignored: the site shows `70-0006` as `70 - 0006`) are opened. A near match such
   as `619633B` for `619633` is a different product and is never used.
2. The product page's `Item #` must equal the MPN, otherwise it is rejected.
3. Every image is fetched (HTTP 200 + `image/*` content type).
4. The page is opened again in a new tab and the key values are compared.
5. One product page can only answer one MPN; a page that comes back for two
   MPNs is flagged, and fitment/image rows always carry their own MPN and URL.

Products that pass every check get `Validation Status = Passed`; anything else is
`Check` with the reason in `Validation Notes` (for example, 500362 is
titled "#500361" on the site while its Item # is 500362).

## Workbook

| Sheet | Rows |
| --- | --- |
| Products | one per product |
| Vehicle Fitment | one per vehicle application |
| Product Images | one per image, with HTTP status |
| Failed Products | MPNs not found, with the search URL and the part numbers the search returned |
| Summary | counts, failure reasons, search method and URL structure |

All sheets have filters, a frozen header row, wrapped text and clickable links.
`output/gibson_products.json` holds the same data, and `output/site-inspection.json`
holds the structure inspection.
