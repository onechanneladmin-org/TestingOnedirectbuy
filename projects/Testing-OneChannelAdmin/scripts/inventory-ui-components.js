/**
 * Single-login walk of all UX-covered admin pages.
 * Collects visually unique UI components (charts, cards, buttons, dropdowns, …),
 * screenshots each once, and writes one large COMPONENTS.md catalog.
 *
 * Usage:
 *   node scripts/inventory-ui-components.js
 *   UX_INVENTORY_LIMIT=10 node scripts/inventory-ui-components.js   # smoke
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const {
  openSignIn,
  signIn,
  openAdminPage,
  waitForAdminUiReady,
  BASE_URL,
} = require("../tests/Onechanneladmin/ux-flows/uxAuditSteps");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "test-results", "ui-component-inventory");
const SHOT_DIR = path.join(OUT_DIR, "shots");
const CATALOG_MD = path.join(OUT_DIR, "COMPONENTS.md");
const CATALOG_JSON = path.join(OUT_DIR, "components.json");
const PAGE_LIST = path.join(ROOT, "test-results", "ux-audit-page-list.json");

const LIMIT = Number(process.env.UX_INVENTORY_LIMIT || 0) || 0;
const MAX_PER_PAGE = Number(process.env.UX_INVENTORY_MAX_PER_PAGE || 40) || 40;
const MAX_TOTAL = Number(process.env.UX_INVENTORY_MAX_TOTAL || 800) || 800;

/** Soft caps so high-value UI kinds are not crowded out by nav/buttons. */
const KIND_CAPS = {
  chart: 80,
  "metric-card": 80,
  card: 120,
  table: 100,
  tabs: 60,
  dropdown: 100,
  input: 80,
  toggle: 40,
  chip: 60,
  modal: 40,
  sidebar: 40,
  button: 120,
  "nav-button": 80,
};

function loadPages() {
  const uxDir = path.join(ROOT, "tests", "Onechanneladmin", "ux-flows");
  const pages = [
    {
      hub: "Home",
      name: "Dashboard",
      path: "/home/dashboard",
      stepPrefix: "HD",
    },
  ];
  for (const file of fs.readdirSync(uxDir).sort()) {
    if (!file.endsWith(".spec.js") || file === "ux-audit-batch.spec.js") continue;
    const text = fs.readFileSync(path.join(uxDir, file), "utf8");
    const hub = (text.match(/"hub":\s*"([^"]+)"/) || [])[1];
    const name = (text.match(/"name":\s*"([^"]+)"/) || [])[1];
    const pagePath = (text.match(/"path":\s*"([^"]+)"/) || [])[1];
    const stepPrefix = (text.match(/"stepPrefix":\s*"([^"]+)"/) || [])[1];
    if (!pagePath) continue;
    pages.push({
      hub: hub || "Page",
      name: name || file.replace(/\.spec\.js$/, ""),
      path: pagePath,
      stepPrefix: stepPrefix || "UX",
    });
  }
  const seen = new Set();
  const uniq = [];
  for (const page of pages) {
    if (seen.has(page.path)) continue;
    seen.add(page.path);
    uniq.push(page);
  }
  fs.mkdirSync(path.dirname(PAGE_LIST), { recursive: true });
  fs.writeFileSync(PAGE_LIST, `${JSON.stringify(uniq, null, 2)}\n`);
  return LIMIT > 0 ? uniq.slice(0, LIMIT) : uniq;
}

function slug(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** In-page collector: classify visible components and build visual fingerprints. */
function collectComponentsInPage() {
  const VIEW_W = window.innerWidth;
  const VIEW_H = window.innerHeight;

  function visible(el) {
    if (!el || el.nodeType !== 1) return false;
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity || "1") < 0.05) {
      return false;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    if (r.bottom < 0 || r.right < 0 || r.top > VIEW_H || r.left > VIEW_W) return false;
    return true;
  }

  function textOf(el, max = 80) {
    const t = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || "")
      .replace(/\s+/g, " ")
      .trim();
    return t.slice(0, max);
  }

  function classTokens(el) {
    return String(el.className || "")
      .split(/\s+/)
      .filter((c) => c && c.length < 40 && !/^[a-z]{1,2}$/i.test(c))
      .slice(0, 8)
      .join(".");
  }

  function sizeBucket(r) {
    const w = Math.round(r.width / 40) * 40;
    const h = Math.round(r.height / 24) * 24;
    return `${w}x${h}`;
  }

  function normalizeLabel(label) {
    return String(label || "")
      .replace(/\d[\d,.]*/g, "#")
      .replace(/\$[\d,.]*/g, "$")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .slice(0, 60);
  }

  function selectorFor(el) {
    if (el.id && /^[A-Za-z][\w-]{0,60}$/.test(el.id)) return `#${el.id}`;
    const role = el.getAttribute("role");
    const aria = el.getAttribute("aria-label");
    if (role && aria) return `[role="${role}"][aria-label="${aria.slice(0, 40)}"]`;
    const tag = el.tagName.toLowerCase();
    const name = el.getAttribute("name");
    if (name) return `${tag}[name="${name}"]`;
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node !== document.body && depth < 4) {
      let nth = 1;
      let sib = node.previousElementSibling;
      while (sib) {
        if (sib.tagName === node.tagName) nth += 1;
        sib = sib.previousElementSibling;
      }
      parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${nth})`);
      node = node.parentElement;
      depth += 1;
    }
    return parts.join(" > ");
  }

  function mark(el) {
    const id = `inv-${Math.random().toString(36).slice(2, 10)}`;
    el.setAttribute("data-inv-id", id);
    return `[data-inv-id="${id}"]`;
  }

  function push(out, kind, el, nameHint) {
    if (!visible(el)) return;
    // Prefer outer unique container: skip if ancestor already queued same kind closely
    const r = el.getBoundingClientRect();
    const label = textOf(el) || nameHint || kind;
    const fingerprint = [
      kind,
      sizeBucket(r),
      normalizeLabel(label).slice(0, 40),
      classTokens(el).split(".").slice(0, 4).join("."),
      el.tagName.toLowerCase(),
      el.getAttribute("role") || "",
      el.getAttribute("type") || "",
    ].join("|");

    out.push({
      kind,
      name: label || kind,
      fingerprint,
      selector: mark(el),
      cssPath: selectorFor(el),
      box: {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      },
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") || "",
      classes: classTokens(el),
    });
  }

  const out = [];

  // Charts / graphs
  document
    .querySelectorAll(
      "canvas, svg.recharts-surface, .recharts-wrapper, [class*=chart], [class*=Chart], [class*=graph], [class*=Graph], [data-testid*=chart]",
    )
    .forEach((el) => {
      const host =
        el.closest("[class*=chart], [class*=Chart], [class*=graph], .recharts-wrapper, section, article, div") ||
        el;
      push(out, "chart", host, "Chart");
    });

  // Metric / KPI cards
  document
    .querySelectorAll(
      "[class*=metric], [class*=Metric], [class*=kpi], [class*=stat-card], [class*=StatCard], [class*=summary-card]",
    )
    .forEach((el) => push(out, "metric-card", el, "Metric card"));

  // Generic cards / panels
  document
    .querySelectorAll(
      "[class*=MuiCard-root], [class*=card], [class*=Card], [class*=panel], [class*=Panel], [class*=tile], [class*=Tile]",
    )
    .forEach((el) => {
      if (el.closest("[class*=metric], [class*=kpi]")) return;
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 60) return;
      push(out, "card", el, "Card");
    });

  // Tables
  document.querySelectorAll("table, [role=grid], [class*=DataGrid], [class*=data-grid]").forEach((el) => {
    push(out, "table", el, "Table");
  });

  // Tabs
  document
    .querySelectorAll("[role=tablist], .MuiTabs-root, [class*=tabs], [class*=Tabs]")
    .forEach((el) => push(out, "tabs", el, "Tabs"));

  // Dropdowns / selects / comboboxes
  document
    .querySelectorAll(
      "select, [role=combobox], [aria-haspopup=listbox], .MuiSelect-root, [class*=dropdown], [class*=Dropdown], [class*=Select]",
    )
    .forEach((el) => {
      const host = el.closest("label, .MuiFormControl-root, div") || el;
      push(out, "dropdown", host.matches("select, [role=combobox]") ? el : host, "Dropdown");
    });

  // Buttons (sample unique by label/size)
  document
    .querySelectorAll("button, [role=button], a.MuiButton-root, .MuiButton-root, input[type=button], input[type=submit]")
    .forEach((el) => {
      if (el.closest("aside, nav, [class*=sidebar], [class*=SideBar]")) {
        push(out, "nav-button", el, textOf(el) || "Nav button");
        return;
      }
      push(out, "button", el, textOf(el) || "Button");
    });

  // Inputs / search
  document
    .querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea")
    .forEach((el) => {
      const host = el.closest("label, .MuiFormControl-root, [class*=search], form, div") || el;
      push(out, "input", host, el.getAttribute("placeholder") || el.getAttribute("name") || "Input");
    });

  // Checkboxes / switches / radios
  document
    .querySelectorAll("input[type=checkbox], input[type=radio], [role=switch], .MuiSwitch-root, .MuiCheckbox-root")
    .forEach((el) => {
      const host = el.closest("label, .MuiFormControlLabel-root, div") || el;
      push(out, "toggle", host, textOf(host) || "Toggle");
    });

  // Chips / badges / pills
  document
    .querySelectorAll("[class*=chip], [class*=Chip], [class*=badge], [class*=Badge], [class*=pill], [class*=tag]")
    .forEach((el) => push(out, "chip", el, textOf(el) || "Chip"));

  // Modals / dialogs (if open)
  document
    .querySelectorAll("[role=dialog], .MuiModal-root, .MuiDialog-root, [class*=modal], [class*=Modal]")
    .forEach((el) => {
      if (!visible(el)) return;
      push(out, "modal", el, "Modal");
    });

  // Sidebars / drawers
  document
    .querySelectorAll("aside, [class*=sidebar], [class*=SideBar], [class*=drawer], [class*=Drawer]")
    .forEach((el) => push(out, "sidebar", el, "Sidebar"));

  // Deduplicate inside page by fingerprint first occurrence
  const seen = new Set();
  const unique = [];
  for (const item of out) {
    if (seen.has(item.fingerprint)) continue;
    seen.add(item.fingerprint);
    unique.push(item);
  }
  return unique.slice(0, 120);
}

async function screenshotComponent(page, item, filePath) {
  const handle = await page.$(item.selector);
  if (!handle) {
    await page.screenshot({ path: filePath, fullPage: false });
    return "viewport-fallback";
  }
  try {
    await handle.evaluate((el) => {
      el.style.setProperty("outline", "2px solid #38bdf8", "important");
      el.style.setProperty("outline-offset", "2px", "important");
    });
    await handle.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(60);
    const box = await handle.boundingBox();
    if (box && box.width > 4 && box.height > 4 && box.width < 1800 && box.height < 1400) {
      await handle.screenshot({ path: filePath, timeout: 5000 });
    } else {
      await page.screenshot({ path: filePath, fullPage: false, timeout: 8000 });
    }
    await handle.evaluate((el) => {
      el.style.removeProperty("outline");
      el.style.removeProperty("outline-offset");
    });
    await handle.dispose().catch(() => {});
    return "element";
  } catch {
    await page.screenshot({ path: filePath, fullPage: false }).catch(() => {});
    return "viewport-fallback";
  }
}

function writeCatalog(components, pagesScanned, errors) {
  const byKind = {};
  for (const c of components) {
    byKind[c.kind] = byKind[c.kind] || [];
    byKind[c.kind].push(c);
  }
  const kinds = Object.keys(byKind).sort();

  const lines = [];
  lines.push(`# OneChannelAdmin UI Component Inventory`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Base URL: ${BASE_URL}`);
  lines.push(`Pages scanned: ${pagesScanned}`);
  lines.push(`Unique components (visual): ${components.length}`);
  lines.push("");
  lines.push(`## Summary by kind`);
  lines.push("");
  lines.push(`| Kind | Count |`);
  lines.push(`|---|---:|`);
  for (const kind of kinds) {
    lines.push(`| ${kind} | ${byKind[kind].length} |`);
  }
  lines.push("");
  if (errors.length) {
    lines.push(`## Page errors`);
    lines.push("");
    for (const err of errors) {
      lines.push(`- **${err.hub} / ${err.name}** (\`${err.path}\`): ${err.error}`);
    }
    lines.push("");
  }

  for (const kind of kinds) {
    lines.push(`## ${kind}`);
    lines.push("");
    for (const c of byKind[kind]) {
      lines.push(`### ${c.componentId} — ${c.displayName}`);
      lines.push("");
      lines.push(`- **Kind:** ${c.kind}`);
      lines.push(`- **First seen:** ${c.hub} / ${c.pageName} (\`${c.pagePath}\`)`);
      lines.push(`- **Size:** ${c.box.w}×${c.box.h} at (${c.box.x}, ${c.box.y})`);
      lines.push(`- **Tag/role:** \`${c.tag}\`${c.role ? ` role=${c.role}` : ""}`);
      if (c.classes) lines.push(`- **Classes:** \`${c.classes}\``);
      lines.push(`- **Selector:** \`${c.cssPath || c.selector}\``);
      lines.push(`- **Fingerprint:** \`${c.fingerprint}\``);
      lines.push(`- **Screenshot:**`);
      lines.push("");
      lines.push(`![${c.displayName}](shots/${c.shotFile})`);
      lines.push("");
    }
  }

  fs.writeFileSync(CATALOG_MD, `${lines.join("\n")}\n`);
  fs.writeFileSync(
    CATALOG_JSON,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        pagesScanned,
        uniqueCount: components.length,
        byKind: Object.fromEntries(kinds.map((k) => [k, byKind[k].length])),
        errors,
        components,
      },
      null,
      2,
    )}\n`,
  );
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const pages = loadPages();
  console.log(`[inventory] pages=${pages.length} out=${OUT_DIR}`);

  const browser = await chromium.launch({
    channel: process.env.PW_USE_CHROME === "0" ? undefined : "chrome",
    headless: process.env.PW_HEADED === "1" ? false : true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  context.on("page", async (extra) => {
    if (extra !== page) await extra.close().catch(() => {});
  });

  const globalSeen = new Set();
  const kindCounts = {};
  const components = [];
  const errors = [];
  let shotIndex = 0;

  await openSignIn(page);
  await signIn(page);
  await waitForAdminUiReady(page);
  console.log("[inventory] logged in once");

  for (let i = 0; i < pages.length; i += 1) {
    const entry = pages[i];
    process.stdout.write(`[inventory] (${i + 1}/${pages.length}) ${entry.hub} / ${entry.name} ${entry.path}\n`);
    try {
      await openAdminPage(page, entry);
      for (const extra of context.pages()) {
        if (extra !== page) await extra.close().catch(() => {});
      }

      const found = await page.evaluate(collectComponentsInPage);
      // Prefer structural components before repetitive controls.
      const kindRank = {
        chart: 0,
        "metric-card": 1,
        card: 2,
        table: 3,
        tabs: 4,
        dropdown: 5,
        modal: 6,
        sidebar: 7,
        input: 8,
        toggle: 9,
        chip: 10,
        button: 11,
        "nav-button": 12,
      };
      found.sort(
        (a, b) => (kindRank[a.kind] ?? 50) - (kindRank[b.kind] ?? 50),
      );

      let pageKept = 0;
      for (const item of found) {
        if (globalSeen.has(item.fingerprint)) continue;
        if (components.length >= MAX_TOTAL) break;
        if (pageKept >= MAX_PER_PAGE) break;
        const kindCap = KIND_CAPS[item.kind] ?? 80;
        if ((kindCounts[item.kind] || 0) >= kindCap) continue;
        globalSeen.add(item.fingerprint);
        kindCounts[item.kind] = (kindCounts[item.kind] || 0) + 1;
        pageKept += 1;
        shotIndex += 1;

        const displayName = (item.name || item.kind).replace(/\s+/g, " ").trim().slice(0, 80) || item.kind;
        const componentId = `${String(shotIndex).padStart(3, "0")}-${item.kind}-${slug(displayName) || "item"}`;
        const shotFile = `${componentId}.png`;
        const shotPath = path.join(SHOT_DIR, shotFile);
        const mode = await screenshotComponent(page, item, shotPath);

        components.push({
          componentId,
          displayName,
          kind: item.kind,
          name: item.name,
          hub: entry.hub,
          pageName: entry.name,
          pagePath: entry.path,
          fingerprint: item.fingerprint,
          selector: item.selector,
          cssPath: item.cssPath,
          box: item.box,
          tag: item.tag,
          role: item.role,
          classes: item.classes,
          shotFile,
          shotMode: mode,
        });
      }
      console.log(`  kept +${pageKept} (total unique ${components.length})`);
    } catch (err) {
      const msg = String(err.message || err).slice(0, 300);
      console.log(`  ERROR ${msg}`);
      errors.push({
        hub: entry.hub,
        name: entry.name,
        path: entry.path,
        error: msg,
      });
    }
  }

  writeCatalog(components, pages.length, errors);
  await browser.close();
  console.log(`[inventory] done unique=${components.length} catalog=${CATALOG_MD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
