const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const g = require("./targetGuard.cjs");

const SPECS = path.resolve(__dirname, "..", "tests", "Zukaongo");
const LIVE = {
  ZUKA_CUSTOMER_URL: "https://zukaongo.com",
  ZUKA_ADMIN_URL: "https://admin.zukaongo.com",
  ZUKA_PARTNER_URL: "https://drivers.zukaongo.com",
  ZUKA_PARTNER_ALIAS_URL: "https://partners.zukaongo.com",
  ZUKA_API_URL: "https://api.zukaongo.com",
};

test("defaults to Zuka staging", () => {
  const r = g.checkTarget({});
  assert.equal(r.ok, true);
  assert.equal(r.prod, false);
  assert.deepEqual(r.urls, g.STAGING_URLS);
});

test("drivers and partners are separate staging hosts", () => {
  const u = g.resolveUrls({});
  assert.equal(u.partner, "https://staging-drivers.zukaongo.com");
  assert.equal(u.partnerAlias, "https://staging-partners.zukaongo.com");
});

test("aliases ZUKA_BASE_URL, ZUKA_DRIVER_URL and ZUKA_PARTNERS_URL are read", () => {
  const u = g.resolveUrls({
    ZUKA_BASE_URL: "http://localhost:8081/",
    ZUKA_DRIVER_URL: "http://localhost:8083",
    ZUKA_PARTNERS_URL: "http://localhost:8084",
  });
  assert.equal(u.customer, "http://localhost:8081");
  assert.equal(u.partner, "http://localhost:8083");
  assert.equal(u.partnerAlias, "http://localhost:8084");
});

test("live drivers.zukaongo.com is refused through every drivers setting", () => {
  for (const k of ["ZUKA_PARTNER_URL", "ZUKA_DRIVER_URL"]) {
    const r = g.checkTarget({ [k]: "https://drivers.zukaongo.com" });
    assert.equal(r.ok, false, k);
    assert.match(r.reason, /partner=https:\/\/drivers\.zukaongo\.com/);
  }
  assert.equal(g.isNonProdUrl("https://staging-drivers.zukaongo.com"), true);
});

test("host classification: only staging/dev zukaongo.com subdomains and local hosts are non-prod", () => {
  for (const u of ["https://staging.zukaongo.com", "https://staging-api.zukaongo.com", "http://localhost:8081"]) {
    assert.equal(g.isNonProdUrl(u), true, u);
  }
  for (const u of [...Object.values(LIVE), "https://staging.evil.com", "not a url"]) {
    assert.equal(g.isNonProdUrl(u), false, u);
  }
});

test("the live sites are refused without ALLOW_PROD_READONLY", () => {
  const r = g.checkTarget(LIVE);
  assert.equal(r.ok, false);
  assert.match(r.reason, /Refusing to run against the live Zuka sites/);
});

test("one live URL among staging ones is refused, even with the flag", () => {
  for (const [k, v] of Object.entries(LIVE)) {
    const r = g.checkTarget({ [k]: v, ALLOW_PROD_READONLY: "1" });
    assert.equal(r.ok, false, k);
    assert.match(r.reason, /different environments/);
  }
});

test("ALLOW_PROD_READONLY=1 runs only the read-only allowlist", () => {
  const r = g.checkTarget({ ...LIVE, ALLOW_PROD_READONLY: "1" });
  assert.equal(r.ok, true);
  assert.equal(r.prod, true);
  assert.deepEqual(r.readOnlySpecs, g.PRODUCTION_READ_ONLY_SPECS);
});

test("write specs can never be allow-listed for production", () => {
  for (const f of ["OrderLifecycle.spec.js", "DriverApp.spec.js", "PartnerOnboarding.spec.js", "PartnerAppUiAudit.spec.js"]) {
    const r = g.checkTarget({ ...LIVE, ALLOW_PROD_READONLY: "1" }, ["Auth.spec.js", f]);
    assert.equal(r.ok, false, f);
    assert.match(r.reason, /never run against production/);
  }
});

test("every spec on disk is either allow-listed or a write spec; allow-listed files exist", () => {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".spec.js")) files.push(e.name);
    }
  };
  walk(SPECS);
  for (const f of g.PRODUCTION_READ_ONLY_SPECS) {
    assert.ok(files.includes(f), `missing ${f}`);
    assert.equal(g.isWriteSpec(f), false, f);
  }
  for (const f of files) {
    assert.ok(g.PRODUCTION_READ_ONLY_SPECS.includes(f) || g.isWriteSpec(f), `unclassified spec: ${f}`);
  }
});

test("non-prod runs block the live hosts in the browser; prod read-only does not", () => {
  const [arg] = g.hostResolverArgs(g.checkTarget({}));
  assert.match(arg, /MAP zukaongo\.com ~NOTFOUND/);
  assert.match(arg, /MAP \*\.zukaongo\.com ~NOTFOUND/);
  assert.match(arg, /EXCLUDE staging-\*\.zukaongo\.com/);
  assert.deepEqual(g.hostResolverArgs(g.checkTarget({ ...LIVE, ALLOW_PROD_READONLY: "1" })), []);
});

test("Node-side API calls: live API refused on staging runs; GET only on prod read-only runs", () => {
  assert.equal(g.assertApiAllowed("https://staging-api.zukaongo.com/api", "POST", {}), true);
  assert.throws(() => g.assertApiAllowed("https://api.zukaongo.com/api", "GET", {}), /live API on a staging run/);
  const prod = { ...LIVE, ALLOW_PROD_READONLY: "1" };
  assert.equal(g.assertApiAllowed("https://api.zukaongo.com/api", "GET", prod), true);
  for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.throws(() => g.assertApiAllowed("https://api.zukaongo.com/api", m, prod), /read-only/, m);
  }
});

test("no test, helper or script falls back to a live Zuka URL", () => {
  const offenders = [];
  for (const dir of ["tests", "scripts"]) {
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(js|cjs|mjs|ts)$/.test(e.name) && /\|\|\s*["'`]https:\/\/([a-z]+\.)?zukaongo\.com/.test(fs.readFileSync(p, "utf8")))
          offenders.push(p);
      }
    };
    walk(path.resolve(__dirname, "..", dir));
  }
  assert.deepEqual(offenders, []);
});
